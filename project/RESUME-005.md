# RESUME — Feature 005 (full reviewer path)

Documento temporal para retomar tras reinicio. Borrar cuando termine el
hito (commit de T040). Contexto completo en `specs/005-full-reviewer-path/`.

## Estado cuando se interrumpió (2026-04-23)

- ✅ Imagen `atw_backend:latest` construida a mano con:
  ```
  docker build --progress=plain -f demo/atw-aurelia/backend/Dockerfile -t atw_backend:latest demo/atw-aurelia/backend/
  ```
- ✅ Datos enriquecidos Opus (166 docs + 3 migraciones) **preservados** en el
  volumen Docker del contenedor standalone viejo `atw_postgres`
  (volumen `38cc50a149f7b8c79e7011b889d18f2a3a0233b2157e274cf331ee3c23bfa413`).
  Este volumen **no se toca** hasta verificar que el `atw.sql` dumpeado
  reconstruye la BD correctamente.
- ⚠️ `demo/atw-aurelia/atw.sql` existe pero el dump actual fue generado con
  `--table=atw_documents --table=atw_migrations` → omite la función
  `public.atw_documents_touch_updated_at()` que usa el trigger → init
  falla con `ERROR: function ... does not exist` en el paso final, aunque
  los 166 docs sí se cargan (`COPY 166`).
- ⚠️ Stack compose en estado inconsistente: `atw_postgres` queda unhealthy
  tras el init fallido; Medusa (postgres/redis/backend/storefront) Up y
  healthy.

## Tareas del plan aún pendientes

- **T039** — añadir `build:` al servicio `atw_backend` del
  `docker-compose.yml` raíz.
- **T040** — commitear `demo/atw-aurelia/atw.sql` (el dump reparado) +
  árbol `demo/atw-aurelia/backend/` + manifest actualizado.
- **T041** — actualizar `.gitignore` para no commitear `backend/node_modules`
  ni `backend/dist`.
- **T037, T038, T042, T043** — tests e2e y docs.
- Phase 7 (T044-T050) — polish.

Ver lista completa: `specs/005-full-reviewer-path/tasks.md`.

## Comandos para retomar (PowerShell, en orden)

**1. Liberar puerto 5433 + arrancar standalone viejo para poder redumpear:**
```powershell
docker compose stop atw_postgres; docker start atw_postgres
```

**2. Redumpear con schema completo** (incluye funciones y triggers):
```powershell
& { "CREATE EXTENSION IF NOT EXISTS vector;"; docker exec atw_postgres pg_dump --no-owner --no-privileges --schema=public -U atw atw } | Set-Content -Path demo/atw-aurelia/atw.sql -Encoding utf8NoBOM; (Get-Content demo/atw-aurelia/atw.sql).Count
```
Esperar un conteo mayor que el dump anterior (que tenía ~225 líneas sin
funciones; el nuevo debe incluir `CREATE FUNCTION ... touch_updated_at`).

**3. Parar standalone + reciclar volumen compose vacío** (no toca Medusa):
```powershell
docker stop atw_postgres; docker compose rm -sfv atw_postgres; docker volume rm ai-to-widget_atw_pg_data
```

**4. Levantar atw_postgres** — esta vez init SQL corre sin fallar:
```powershell
docker compose up -d atw_postgres --wait
```

**5. Verificar** (debe dar `166`):
```powershell
docker exec ai-to-widget-atw_postgres-1 psql -U atw -d atw -c "SELECT count(*) FROM atw_documents;"
```

**6. Arrancar el resto si el 5 sale bien:**
```powershell
docker compose up -d --wait
```

**7. Smoke test del backend:**
```powershell
curl http://localhost:3100/health
```

## Si algo falla

- `docker logs ai-to-widget-atw_postgres-1 2>&1 | Select-Object -Last 60`
  para ver qué falló en init.
- El volumen standalone `38cc50a…` sigue siendo el backup hasta que el
  reviewer path quede verificado end-to-end. **No borrarlo** antes de
  confirmar que el atw.sql reconstruye todo.
- Para limpieza final, cuando el reviewer path ya funcione: `docker rm
  atw_postgres; docker volume rm 38cc50a149f7b8c79e7011b889d18f2a3a0233b2157e274cf331ee3c23bfa413`.

## Tras verificar que todo arranca

1. Commitear: `atw.sql`, árbol `demo/atw-aurelia/backend/`, manifest,
   cambios orchestrator/render/types, tests nuevos.
2. Aplicar T039 (build: directive en docker-compose.yml raíz).
3. Flip de checkboxes en `tasks.md` solo tras verificar código (ver
   convención: `feedback_resume_after_crash.md` en memory).
4. Borrar este `RESUME-005.md`.

## Advertencias importantes

- **NO** ejecutar `docker compose down -v` mientras el dump aún no esté
  verificado — tira también `medusa_pg_data` y obliga a re-sembrar
  Medusa. Usar siempre la variante quirúrgica: `docker compose rm -sfv
  atw_postgres && docker volume rm ai-to-widget_atw_pg_data`.
- El usuario ejecuta los comandos manualmente (no delegar a la Bash
  tool sin confirmación explícita).
