import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import {
  ChatRequestSchema,
  type ChatRequest,
  type ChatResponse,
  type Citation,
} from "../_shared/types.js";
import type { RuntimeConfig } from "../config.js";
import { embed } from "../lib/embedding.js";
import { runRetrieval, type RetrievalHit } from "../lib/retrieval.js";
import { formatRetrievalContext } from "../lib/retrieval-context.js";
import {
  runOpusStep,
  type AnthropicMessages,
} from "../lib/opus-client.js";
import { SYSTEM_PROMPT } from "../prompts.js";
import { ValidationError } from "../lib/errors.js";
import { ACTION_TOOLS } from "../tools.js";
import { assembleToolResultMessages } from "../lib/tool-result-assembly.js";

/**
 * POST /v1/chat — runtime handler.
 *
 * Feature 007 v2 contract:
 *   specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md.
 *
 * The endpoint is stateless across mid-turn posts: the widget carries
 * the conversation state and `tool_call_budget_remaining` on every
 * request. The backend never executes shop-side fetches — it emits an
 * `ActionIntent` on `tool_use` and relies on the widget to post the
 * tool result back.
 */
export function registerChat(
  app: FastifyInstance,
  pool: Pool,
  config: RuntimeConfig,
): void {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  app.addHook("onRequest", async (req) => {
    (req as unknown as { atw_start?: number }).atw_start = Date.now();
  });

  app.post("/v1/chat", async (req, reply) => {
    const requestId = req.id;
    let body: ChatRequest;
    try {
      body = ChatRequestSchema.parse(req.body);
    } catch (err) {
      const rawMessage = (req.body as { message?: unknown })?.message;
      if (typeof rawMessage === "string" && rawMessage.length > 4000) {
        throw new ValidationError(
          "That message is too long. Please shorten and try again.",
          "message_too_long",
        );
      }
      const msg = err instanceof Error ? err.message : "Invalid request body";
      throw new ValidationError(
        "Some of the fields you sent were malformed: " + msg,
      );
    }

    const resumingToolCall = body.tool_result !== undefined;
    const pendingTurnId =
      body.pending_turn_id ?? (resumingToolCall ? null : randomUUID());

    let budget: number;
    if (resumingToolCall) {
      budget =
        typeof body.tool_call_budget_remaining === "number"
          ? body.tool_call_budget_remaining
          : 0;
    } else {
      budget = config.maxToolCallsPerTurn;
    }

    // Initial post: run retrieval + embedding. Resume posts skip both
    // entirely (FR-018, stateless backend across mid-turn posts).
    let hits: RetrievalHit[] = [];
    let retrievalContext = "";
    if (!resumingToolCall) {
      const queryVec = await embed(body.message);
      hits = await runRetrieval({
        embedding: queryVec,
        threshold: config.retrievalThreshold,
        topK: config.retrievalTopK,
        pool,
      });
      retrievalContext = formatRetrievalContext(hits);
    }

    const trimmedHistory = body.history.slice(-config.maxConversationTurns);
    const historyTrimmed = trimmedHistory.length < body.history.length;

    const messages: AnthropicMessages = trimmedHistory.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    if (historyTrimmed) {
      messages.unshift({
        role: "assistant",
        content:
          "(conversation trimmed — earlier turns were dropped to fit the session cap)",
      });
    }

    let messagesForOpus: AnthropicMessages;
    if (resumingToolCall && body.tool_result) {
      // Feature 008 (v3) — the widget's conversation is string-content
      // only; synthesize the assistant tool_use turn the backend never
      // received so Anthropic sees a well-formed trio. Reject unknown
      // tool names structurally before we forward to Opus.
      if (!ACTION_TOOLS.includes(body.tool_result.tool_name)) {
        throw new ValidationError(
          `tool_result.tool_name "${body.tool_result.tool_name}" is not in the deployed manifest`,
          "tool_not_allowed",
        );
      }
      messagesForOpus = assembleToolResultMessages({
        history: trimmedHistory.map((t) => ({
          role: t.role,
          content: t.content,
        })),
        toolResult: body.tool_result,
      });
    } else {
      messages.push({
        role: "user",
        content:
          body.message +
          "\n\n[Retrieval context — use only facts from this block; reply that the catalog does not cover the topic if nothing relevant is here.]\n" +
          retrievalContext,
      });
      messagesForOpus = messages;
    }

    const budgetExhausted = budget <= 0;

    const step = await runOpusStepWithToolResultRetry({
      resumingToolCall,
      toolResultIsError: body.tool_result?.is_error ?? false,
      run: () =>
        runOpusStep({
          client: anthropic,
          model: "claude-opus-4-7",
          system: SYSTEM_PROMPT,
          messages: messagesForOpus,
          sessionContext: body.context,
          forceComposition: budgetExhausted,
        }),
    });

    if (step.kind === "response_generation_failed") {
      // Feature 008 / FR-020a — the action succeeded but the second
      // Opus call exhausted its retry budget. The widget renders the
      // pinned fallback string and clears `pending_turn_id`.
      reply.code(200);
      return {
        response_generation_failed: true,
        action_succeeded: true,
        pending_turn_id: null,
      };
    }

    const latency =
      Date.now() -
      ((req as unknown as { atw_start?: number }).atw_start ?? Date.now());

    if (step.kind === "action_intent") {
      // Enforce the action allowlist structurally before emit.
      if (!ACTION_TOOLS.includes(step.intent.tool)) {
        throw new ValidationError(
          `Opus emitted tool "${step.intent.tool}" which is not in the allowlist.`,
          "tool_not_allowed",
        );
      }
      const response: ChatResponse = {
        message: "",
        citations: [],
        actions: [step.intent],
        action_intent: step.intent,
        pending_turn_id: pendingTurnId,
        tool_call_budget_remaining: Math.max(0, budget - 1),
        request_id: requestId,
      };
      req.log.info(
        {
          req_id: requestId,
          latency_ms: latency,
          tool: step.intent.tool,
          budget_remaining: response.tool_call_budget_remaining,
          pending_turn_id: pendingTurnId,
        },
        "chat turn emitted action_intent",
      );
      reply.code(200);
      return response;
    }

    const text =
      step.text.length > 0
        ? step.text
        : "I'm not sure I can help with that — could you rephrase?";
    const citations = resumingToolCall
      ? []
      : deriveCitations(hits, text);

    const response: ChatResponse = {
      message: text,
      citations,
      actions: [],
      pending_turn_id: null,
      request_id: requestId,
    };

    req.log.info(
      {
        req_id: requestId,
        latency_ms: latency,
        citations: citations.length,
        input_tokens: step.usage.input_tokens,
        output_tokens: step.usage.output_tokens,
        resumed: resumingToolCall,
        message_preview: resumingToolCall ? "" : body.message.slice(0, 80),
      },
      "chat turn complete",
    );

    reply.code(200);
    return response;
  });
}

/**
 * Feature 008 / FR-020a — post-`tool_result` retry policy.
 *
 * The second Opus call (the one that composes the natural-language
 * reply after a tool_result) gets 3 additional attempts after the
 * initial try, with 500 ms → 1 s → 2 s backoff between attempts. On
 * exhaustion, the handler returns the `response_generation_failed`
 * discriminator so the widget can render the pinned fallback string.
 *
 * Only the post-tool_result call participates. Initial pre-tool_use
 * calls and any `tool_result` whose `is_error` is true retain the
 * pre-existing error handling (the error text is a normal result Opus
 * can explain). Contract: chat-endpoint-v3.md §Retry policy.
 */
const POST_TOOL_RESULT_RETRY_DELAYS_MS = [500, 1000, 2000] as const;

type RunOpusStepFn = () => Promise<
  Awaited<ReturnType<typeof runOpusStep>>
>;

type OpusRetryResult =
  | Awaited<ReturnType<typeof runOpusStep>>
  | { kind: "response_generation_failed" };

async function runOpusStepWithToolResultRetry(args: {
  resumingToolCall: boolean;
  toolResultIsError: boolean;
  run: RunOpusStepFn;
}): Promise<OpusRetryResult> {
  const shouldRetry = args.resumingToolCall && !args.toolResultIsError;
  if (!shouldRetry) {
    return args.run();
  }
  const maxAttempts = 1 + POST_TOOL_RESULT_RETRY_DELAYS_MS.length;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await args.run();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1) break;
      const delay = POST_TOOL_RESULT_RETRY_DELAYS_MS[attempt];
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void lastErr;
  return { kind: "response_generation_failed" };
}

function deriveCitations(hits: RetrievalHit[], message: string): Citation[] {
  const lower = message.toLowerCase();
  const matched = hits.filter(
    (h) =>
      lower.includes(h.entity_id.toLowerCase()) ||
      (h.document.length > 0 &&
        lower.includes(firstTitle(h.document).toLowerCase())),
  );
  const chosen = matched.length > 0 ? matched : hits.slice(0, 3);
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const h of chosen) {
    const key = `${h.entity_type}/${h.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      entity_id: h.entity_id,
      entity_type: h.entity_type,
      relevance: Math.max(0, Math.min(1, h.similarity)),
      title: firstTitle(h.document),
    });
  }
  return citations;
}

function firstTitle(document: string): string {
  const head = document.split(/[.!?]/)[0]?.trim() ?? document;
  return head.length > 60 ? head.slice(0, 60) + "…" : head;
}
