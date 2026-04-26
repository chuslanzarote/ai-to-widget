# Sample Runtime Interactions

> Illustrative end-to-end traces of what the runtime agent does when real shoppers interact with the widget. These are not user stories or hypothetical examples — they are the exact flow the backend must support. Every scenario is played out: user turn, widget request, RAG retrieval, Opus call, tool calls, widget rendering, confirmations.
>
> These are the scenarios the demo video must successfully demonstrate.

---

## Scenario 1: Flavor-profile recommendation

### User turn

> *"Estoy buscando un café chocolatoso, con algo de fruta roja pero sin ser demasiado ácido. Para filtro, en V60."*

### Widget → Backend request

```json
POST /v1/chat
{
  "message": "Estoy buscando un café chocolatoso, con algo de fruta roja pero sin ser demasiado ácido. Para filtro, en V60.",
  "history": [],
  "context": {
    "cart_id": "cart_01HK2M...",
    "customer_id": null,
    "region_id": "reg_eu",
    "locale": "es-ES"
  }
}
```

### Backend processing

**Step 1: embed query.**
Query is embedded with `bge-small-multilingual-v1.5`. Vector dimension 384.

**Step 2: RAG retrieval.**
`SELECT entity_id, document, 1 - (embedding <=> $1) AS similarity FROM agentforge_documents WHERE similarity > 0.55 ORDER BY similarity DESC LIMIT 8;`

Top results (with similarity scores):

1. `prod_col_huila_pulped_natural` — 0.84
2. `prod_bra_cerrado_natural` — 0.79
3. `prod_eth_sidamo_washed` — 0.71 (too bright, marginal)
4. `prod_gua_antigua_washed` — 0.68
5. `prod_pan_geisha_natural` — 0.66
6. (others below threshold)

**Step 3: Opus call.**

System prompt + business context + retrieved documents + user message.

```
Retrieved entities:

<entity id="prod_col_huila_pulped_natural">
Colombia Huila Pulped Natural. 250g bag, whole bean, light-medium roast.
Pulped-natural process (pulp removed but mucilage left on bean during drying).
Cupping notes: dark chocolate, cherry, molasses, medium body, soft acidity.
Origin: Huila region, Colombia, altitude 1700m.
Works particularly well for filter methods, including V60 and Chemex.
Limited edition: no. Current stock: 14 units of 250g, 3 units of 1kg.
Cited fields: title, description, metadata.cupping_notes, metadata.origin,
  metadata.altitude, metadata.process, metadata.recommended_methods, tags.
</entity>

<entity id="prod_bra_cerrado_natural">
Brazil Cerrado Natural. 250g bag, whole bean, medium roast.
Natural process. Cupping notes: milk chocolate, hazelnut, caramel, low acidity,
syrupy body. Brazilian Cerrado region, altitude 1100m.
Excellent for espresso and moka pot. Less ideal for pourover due to low acidity.
...
</entity>

[... other entities ...]
```

Tools available in this call: `search_products`, `get_product`, `list_categories`, `list_collections`, `list_regions`, `get_region`, `get_cart`.

**Step 4: Opus response.**

Opus does not call any tools (RAG was sufficient). It generates a text response with two recommendations.

### Backend → Widget response

```json
{
  "message": "Tengo dos que te pueden encajar muy bien:\n\n**Colombia Huila Pulped Natural** — notas de chocolate oscuro, cereza y melaza. Acidez suave, cuerpo medio. El proceso *pulped natural* (se quita la pulpa pero se deja el mucílago al secar) le da ese punto frutal sin pasarse de ácido. Para V60 es excelente.\n\n**Brazil Cerrado Natural** — más chocolate con leche, avellana y caramelo. Muy poca acidez, cuerpo denso. Si buscas lo chocolatoso por encima de lo frutal, este lo clava. Aunque es más típico de espresso o moka, también funciona en V60 con una molienda un poco más gruesa.\n\nSi la fruta te importa más, elige el Colombia. Si prefieres que predomine el chocolate, el Brasil. ¿Te enseño más detalles de alguno?",
  "citations": [
    { "entity_id": "prod_col_huila_pulped_natural", "relevance": 0.84 },
    { "entity_id": "prod_bra_cerrado_natural", "relevance": 0.79 }
  ],
  "actions": [],
  "suggestions": [
    "Ver el Colombia Huila",
    "Ver el Brazil Cerrado",
    "Muéstrame otras opciones"
  ]
}
```

### Widget rendering

Message rendered as markdown with the two product names as clickable links to their storefront pages. Suggestion chips at the bottom. No action card.

---

## Scenario 2: Head-to-head comparison with live data

### User turn (continuing previous conversation)

> *"Vale, muéstrame el Colombia en 250g y dime qué molienda pedir si lo uso en V60."*

### Widget → Backend request

```json
POST /v1/chat
{
  "message": "Vale, muéstrame el Colombia en 250g y dime qué molienda pedir si lo uso en V60.",
  "history": [
    { "role": "user", "content": "Estoy buscando un café chocolatoso..." },
    { "role": "assistant", "content": "Tengo dos que te pueden encajar..." }
  ],
  "context": { /* same as before */ }
}
```

### Backend processing

**Step 1: embed query + do RAG.**
Retrieves `prod_col_huila_pulped_natural` (the entity under discussion) and brewing-method guidance documents if present.

**Step 2: Opus call with history + new RAG context.**

Opus decides it needs live data (price and stock of the 250g variant). It emits a tool call.

```json
{
  "type": "tool_use",
  "id": "toolu_01...",
  "name": "get_product",
  "input": { "id": "prod_col_huila_pulped_natural" }
}
```

**Step 3: backend executes tool call.**

Backend calls `GET /store/products/prod_col_huila_pulped_natural` on Medusa. Response includes all variants with current prices and stock.

```json
{
  "id": "prod_col_huila_pulped_natural",
  "title": "Colombia Huila Pulped Natural",
  "variants": [
    {
      "id": "var_col_huila_250g_whole",
      "title": "250g / Whole bean",
      "sku": "COL-HUILA-250-WB",
      "prices": [{ "amount": 1450, "currency_code": "eur" }],
      "inventory_quantity": 14,
      "options": [
        { "option_id": "opt_size", "value": "250g" },
        { "option_id": "opt_grind", "value": "Whole bean" }
      ]
    },
    {
      "id": "var_col_huila_250g_v60",
      "title": "250g / V60 grind",
      "sku": "COL-HUILA-250-V60",
      "prices": [{ "amount": 1450, "currency_code": "eur" }],
      "inventory_quantity": 8,
      "options": [
        { "option_id": "opt_size", "value": "250g" },
        { "option_id": "opt_grind", "value": "V60 grind" }
      ]
    },
    // ... other variants
  ]
}
```

**Step 4: Opus receives tool result, generates response.**

Opus notices that a pre-ground "V60 grind" variant exists. It tailors its recommendation accordingly.

### Backend → Widget response

```json
{
  "message": "Aquí está:\n\n**Colombia Huila Pulped Natural — 250g — 14,50€**\n\nSi lo usas en V60, tienes dos opciones:\n\n1. **Grano entero (14 unidades disponibles)** — si tienes molinillo en casa, esta es la mejor opción. La molienda ideal para V60 es media-fina, parecida a la sal marina gruesa. Molerlo justo antes de preparar conserva mucho más aroma.\n\n2. **Molido para V60 (8 unidades disponibles)** — ya viene con la molienda ajustada al V60. Si no tienes molinillo o prefieres comodidad, esta es tu opción. El sabor será muy bueno durante unas 2 semanas tras el tostado.\n\nRatio recomendado: 15g de café por 250ml de agua. Temperatura 93°C. Tiempo total ~3 minutos.",
  "citations": [
    { "entity_id": "prod_col_huila_pulped_natural", "relevance": 0.91 }
  ],
  "actions": [],
  "suggestions": [
    "Añadir 1x grano entero al carrito",
    "Añadir 1x V60 grind al carrito",
    "¿Qué molinillo me recomiendas?"
  ]
}
```

---

## Scenario 3: Action with confirmation

### User turn (continuing)

> *"Añade dos bolsas del grano entero al carrito."*

### Backend processing

**Step 1: RAG is skipped (agent already has context from history).**

**Step 2: Opus decides to propose the action.**

Two tool calls in sequence:

```json
{
  "type": "tool_use",
  "name": "get_cart",
  "input": { "id": "cart_01HK2M..." }
}
```

Cart retrieval returns the current state (empty or with prior items). Opus now has full context.

```json
{
  "type": "tool_use",
  "name": "add_to_cart",
  "input": {
    "cart_id": "cart_01HK2M...",
    "variant_id": "var_col_huila_250g_whole",
    "quantity": 2
  }
}
```

**Step 3: backend sees `add_to_cart` is flagged `requires_user_confirmation=true`.**

It does NOT execute the call. Instead, it returns an action intent to the widget.

### Backend → Widget response

```json
{
  "message": "¿Confirmas que añada 2 bolsas de Colombia Huila Pulped Natural (250g / grano entero) al carrito?",
  "citations": [],
  "actions": [
    {
      "id": "act_01HK2P...",
      "type": "http_call",
      "requires_confirmation": true,
      "summary": {
        "title": "Añadir al carrito",
        "product": "Colombia Huila Pulped Natural",
        "variant": "250g / Grano entero",
        "quantity": 2,
        "unit_price": "14,50€",
        "total": "29,00€",
        "product_image": "https://demo.aurelia.../col-huila.jpg"
      },
      "execution": {
        "method": "POST",
        "path": "/store/carts/cart_01HK2M.../line-items",
        "body": { "variant_id": "var_col_huila_250g_whole", "quantity": 2 },
        "auth": "inherit"
      },
      "buttons": [
        { "label": "Añadir al carrito", "action": "execute" },
        { "label": "Cancelar", "action": "dismiss" }
      ]
    }
  ],
  "suggestions": []
}
```

### Widget rendering

A confirmation card appears in the chat below the assistant's message. The card shows the product image, title, variant, quantity, unit price, and total. Two buttons.

### User clicks "Añadir al carrito"

Widget executes:

```javascript
const result = await fetch(
  "/store/carts/cart_01HK2M.../line-items",
  {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant_id: "var_col_huila_250g_whole", quantity: 2 })
  }
);
```

The call goes to Medusa directly, with the shopper's cart cookie attached by the browser. Medusa responds with the updated cart.

### Widget confirms to backend

A follow-up message is sent to record what happened:

```json
POST /v1/chat
{
  "message": null,
  "history": [ /* ... including previous turns ... */ ],
  "context": { /* ... */ },
  "action_result": {
    "action_id": "act_01HK2P...",
    "status": "success",
    "response_summary": "Cart now has 2x Colombia Huila (29.00 EUR)."
  }
}
```

### Opus response (short)

Opus generates a brief confirmation message.

### Backend → Widget response

```json
{
  "message": "Hecho. Tu carrito tiene ahora 2 bolsas de Colombia Huila por 29,00€. ¿Algo más?",
  "citations": [],
  "actions": [],
  "suggestions": [
    "Ver el carrito",
    "Algún filtro para V60",
    "Seguir viendo cafés"
  ]
}
```

---

## Scenario 4: Out-of-scope refusal

### User turn

> *"¿Qué opinas del nuevo Starbucks Reserve?"*

### Backend processing

**Step 1: RAG.** No hits above threshold (the index contains only Aurelia products).

**Step 2: Opus call.**

The system prompt includes the rule: *"Never compare Aurelia to named competitors."* Opus recognizes the situation.

### Backend → Widget response

```json
{
  "message": "No te puedo dar opinión sobre otras tiendas. Pero si me cuentas qué tipo de café te gusta del Starbucks Reserve, puedo buscarte algo parecido (o muy distinto, si eso es lo que buscas) en nuestro catálogo.",
  "citations": [],
  "actions": [],
  "suggestions": [
    "Me gustan los cafés cremosos",
    "Prefiero algo más ácido y floral",
    "No sé, sorpréndeme"
  ]
}
```

---

## Scenario 5: Stock check reveals unavailability

### User turn

> *"¿Tenéis el Geisha de Panamá?"*

### Backend processing

**Step 1: RAG retrieval.**

Top hit: `prod_pan_geisha_natural` with similarity 0.89.

**Step 2: Opus receives RAG context but calls `get_product` to check live stock.**

```json
{ "type": "tool_use", "name": "get_product", "input": { "id": "prod_pan_geisha_natural" } }
```

Medusa returns: all variants have `inventory_quantity = 0`.

**Step 3: Opus crafts response acknowledging unavailability.**

### Backend → Widget response

```json
{
  "message": "El Panamá Geisha lo tenemos en catálogo pero ahora mismo está agotado. Es un lote muy limitado que solemos reponer trimestralmente. Si quieres algo parecido (floral, frutal, complejo), el **Etiopía Sidamo Washed** anda por ese registro — más asequible y con notas de jazmín y bergamota. Si te interesa específicamente un Geisha, puedo apuntar tu email para avisarte cuando vuelva, si quieres.",
  "citations": [
    { "entity_id": "prod_pan_geisha_natural", "relevance": 0.89 },
    { "entity_id": "prod_eth_sidamo_washed", "relevance": 0.74 }
  ],
  "actions": [],
  "suggestions": [
    "Ver el Etiopía Sidamo",
    "Avísame cuando vuelva el Geisha",
    "Muéstrame otros limited lots"
  ]
}
```

**Note.** "Avísame cuando vuelva" would be an action in a real implementation but is out of scope for V1. Listed as a suggestion, not as an action intent. If clicked, the widget shows a message directing the user to the manual waitlist signup.

---

## Scenario 6: Agent handles ambiguous variant

### User turn

> *"Añádelo al carrito."*

### Backend processing

**Step 1: Opus reviews history.**

In the history, multiple products have been mentioned. The reference "lo" is ambiguous.

**Step 2: Opus responds by disambiguating, not guessing.**

### Backend → Widget response

```json
{
  "message": "¿Cuál de los dos quieres añadir?\n\n- **Colombia Huila Pulped Natural** (250g / 14,50€)\n- **Brazil Cerrado Natural** (250g / 13,90€)\n\nY dime también si prefieres grano entero o ya molido.",
  "citations": [],
  "actions": [],
  "suggestions": [
    "Colombia, grano entero",
    "Brasil, molido para V60",
    "Cancelar"
  ]
}
```

The agent never guesses an action. Disambiguation is always conversational.

---

## Scenario 7: Logged-in shopper, personalized context

### User turn

> *"¿Qué pedí la última vez?"*

### Widget → Backend request

```json
POST /v1/chat
{
  "message": "¿Qué pedí la última vez?",
  "history": [],
  "context": {
    "cart_id": "cart_01HK2M...",
    "customer_id": "cus_01HJ...",
    "region_id": "reg_eu",
    "locale": "es-ES"
  }
}
```

### Backend processing

**Step 1: Opus sees `customer_id` is present.**

It decides to call `list_my_orders`.

```json
{ "type": "tool_use", "name": "list_my_orders", "input": { "limit": 1 } }
```

Medusa returns the most recent order for that customer.

**Step 2: Opus crafts response.**

### Backend → Widget response

```json
{
  "message": "Tu último pedido (orden #10423, del 14 de abril) incluyó:\n\n- 2 × Colombia Huila Pulped Natural, 250g grano entero\n- 1 × Filtros V60 x100\n\nTotal: 36,40€. Entregado el 17 de abril.\n\n¿Quieres repetir el pedido, o algo distinto esta vez?",
  "citations": [],
  "actions": [],
  "suggestions": [
    "Repetir el pedido",
    "Lo mismo pero otro origen",
    "Algo diferente"
  ]
}
```

**Note.** "Repetir el pedido" would involve multiple `add_to_cart` calls. The widget can handle this by receiving a list of action intents. For V1, this is possible but not demoed as a hero flow.

---

## Scenario 8: Guest shopper asks about their orders

### User turn

> *"¿Cuándo llega mi pedido?"*

### Backend processing

**Step 1: Opus sees `customer_id` is null.**

It does not call `list_my_orders` (would fail). Instead, it asks the user to authenticate.

### Backend → Widget response

```json
{
  "message": "Para consultar pedidos necesito que inicies sesión. Arriba a la derecha tienes 'Mi cuenta'. En cuanto entres, te puedo decir el estado de tu pedido al instante.",
  "citations": [],
  "actions": [],
  "suggestions": [
    "¿Cómo recupero mi contraseña?",
    "Compré sin cuenta"
  ]
}
```

**Note.** If the shopper mentions they purchased as a guest, the agent directs them to the order-tracking page (which uses order number + email). The agent itself does not perform guest order lookup in V1 (it would require exposing a PII-sensitive endpoint).

---

## Non-goal scenarios (what the agent does NOT do)

- Propose actions without explicit user consent.
- Claim products exist that do not (hallucination guard).
- Quote prices from RAG that may be stale — always reads live via `get_product`.
- Respond to prompt-injection attempts in product descriptions ("ignore previous instructions"). Mitigation: system prompt explicitly states that product descriptions are user-visible data, not instructions.
- Execute admin-scoped operations, even if asked politely.
- Reveal other customers' information.
- Give brewing advice that requires liability (water safety, allergies).
- Work indefinitely in one turn. There is a cap of 5 sequential tool calls per user message. If exceeded, the agent responds with partial results and asks how to proceed.
