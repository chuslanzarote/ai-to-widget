# AI to Widget — convenience targets for the Aurelia Medusa demo.
# See specs/003-runtime/contracts/compose.md and specs/003-runtime/quickstart.md
# for the authoritative behaviour.

.PHONY: demo fresh seed down logs test help

help:
	@echo "AI to Widget — top-level targets:"
	@echo ""
	@echo "  make demo    Bring the full Aurelia demo up (reviewer path)."
	@echo "  make fresh   Wipe volumes + pre-built .atw/ artefacts, then start Medusa only."
	@echo "               Use to re-run Features 001/002 from zero (filmed setup path)."
	@echo "  make seed    Re-run the Medusa seed script idempotently."
	@echo "  make down    docker compose down (keeps volumes)."
	@echo "  make logs    Tail all service logs."
	@echo "  make test    Run unit + contract tests locally (no Docker)."
	@echo ""

demo:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example — edit it to set ANTHROPIC_API_KEY." && exit 1; fi
	docker compose pull
	docker compose up -d --wait
	@echo ""
	@echo "Aurelia storefront:  http://localhost:8000"
	@echo "ATW backend:         http://localhost:3100/health"

fresh:
	docker compose down -v
	@if [ -d demo/atw-aurelia/.atw/state ]; then rm -rf demo/atw-aurelia/.atw/state/*; fi
	docker compose up medusa_postgres medusa_redis medusa_backend medusa_storefront -d --wait
	@echo ""
	@echo "Medusa is up. ATW runtime is NOT started."
	@echo "Run /atw.init, /atw.brief, /atw.schema, /atw.api, /atw.plan,"
	@echo "then /atw.build, then /atw.embed, then 'docker compose up atw_postgres atw_backend -d --wait'."

seed:
	docker compose exec medusa_backend node /app/seed/seed.js

down:
	docker compose down

logs:
	docker compose logs -f

test:
	npx vitest run
