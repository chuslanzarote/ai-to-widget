# Action manifest

## Provenance

- OpenAPI snapshot: sha256:0000000000000000000000000000000000000000000000000000000000000000
- Classifier model: claude-opus-4-7 (2026-04-23)
- Classified at: 2026-04-23T10:00:00Z

## Summary

Single shopper-facing write wired against the tiny-demo fixture plus one
admin operation deliberately excluded. Exists so the parser, renderer,
and delta-merge tests have a minimal well-formed input they can pin
byte-for-byte.

## Tools: demo

### post_widget_demo

Description: Submit a demo action against the tiny fixture.
description_template: "Submit demo: {message}"
summary_fields: ["message", "quantity"]

Parameters:

```json
{
  "type": "object",
  "required": ["message"],
  "properties": {
    "message": { "type": "string", "minLength": 1, "maxLength": 200 },
    "quantity": { "type": "integer", "minimum": 1, "maximum": 10, "default": 1 }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /widget/demo
Parameter sources: user message

## Excluded

- POST /admin/users — admin-prefix
