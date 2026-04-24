# AI to Widget — Windows-native runner that mirrors the Makefile targets.
#
# Use when `make` is not available or when you're on plain PowerShell.
# Same behaviour as the Makefile; same preconditions; same error messages.
#
# Usage:
#   .\scripts\make.ps1 <target>
#
# Targets: demo, fresh, seed, down, logs, stage-widget, check-env, check-image, help
#
# Example:
#   .\scripts\make.ps1 fresh
#   .\scripts\make.ps1 stage-widget
#   .\scripts\make.ps1 demo

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'demo', 'fresh', 'seed', 'down', 'logs', 'stage-widget', 'check-env', 'check-image', 'test')]
    [string] $Target = 'help'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

function Invoke-Docker {
    param([Parameter(ValueFromRemainingArguments)][string[]] $Args)
    & docker.exe @Args
    if ($LASTEXITCODE -ne 0) { throw "docker $($Args -join ' ') exited with code $LASTEXITCODE" }
}

function Show-Help {
    @"
AI to Widget — PowerShell runner

Targets:
  help           Show this message.
  demo           Bring the full Aurelia demo up (runs check-env, check-image, stage-widget first).
  fresh          Wipe volumes + pre-built .atw state, start only Medusa (setup-flow path).
  seed           Re-run the Medusa seed script.
  down           docker compose down (keeps volumes).
  logs           Tail all service logs (Ctrl+C to quit).
  stage-widget   Copy dist/widget.{js,css} into demo/medusa/storefront/public/ (stub if missing).
  check-env      Verify .env exists with a real ANTHROPIC_API_KEY.
  check-image    Verify atw_backend:latest exists locally.
  test           Run the unit + contract suite (no Docker).

Examples:
  .\scripts\make.ps1 fresh
  .\scripts\make.ps1 stage-widget
  .\scripts\make.ps1 demo
"@ | Write-Host
}

function Invoke-CheckEnv {
    if (-not (Test-Path .env)) {
        Copy-Item .env.example .env
        Write-Host ''
        Write-Host '────────────────────────────────────────────────────────────────' -ForegroundColor Yellow
        Write-Host 'Created .env from .env.example.'
        Write-Host 'Open it and set ANTHROPIC_API_KEY before re-running demo.'
        Write-Host '────────────────────────────────────────────────────────────────' -ForegroundColor Yellow
        exit 1
    }
    $content = Get-Content .env -Raw
    if ($content -notmatch '(?m)^ANTHROPIC_API_KEY=.+') {
        Write-Host ''
        Write-Host 'ERROR: ANTHROPIC_API_KEY is unset in .env.' -ForegroundColor Red
        Write-Host 'Edit .env and set a real key from https://console.anthropic.com/.'
        exit 1
    }
    if ($content -match '(?m)^ANTHROPIC_API_KEY=your-key-here') {
        Write-Host ''
        Write-Host 'ERROR: ANTHROPIC_API_KEY is still the placeholder in .env.' -ForegroundColor Red
        Write-Host 'Edit .env and replace `your-key-here` with your real Anthropic key.'
        exit 1
    }
}

function Invoke-CheckImage {
    & docker.exe image inspect atw_backend:latest 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host '────────────────────────────────────────────────────────────────' -ForegroundColor Yellow
        Write-Host 'ERROR: atw_backend:latest is not built yet.' -ForegroundColor Red
        Write-Host ''
        Write-Host 'The runtime backend image is produced locally by /atw.build —'
        Write-Host "it is NOT published on Docker Hub, so 'docker compose up' cannot"
        Write-Host 'pull it. Choose one of these paths (see TESTING-GUIDE.md §5.1):'
        Write-Host ''
        Write-Host "  1) Cheapest ('`$0'): build it without enrichment (widget works"
        Write-Host "     but retrieval replies 'not in catalog'):"
        Write-Host ''
        Write-Host '       .\scripts\make.ps1 fresh'
        Write-Host '       cd demo\atw-shop-host; claude'
        Write-Host '       > /atw.build --no-enrich'
        Write-Host ''
        Write-Host "  2) Full (~`$14 Opus, one-time) with full enrichment:"
        Write-Host ''
        Write-Host '       .\scripts\make.ps1 fresh'
        Write-Host '       cd demo\atw-shop-host; claude'
        Write-Host '       > /atw.build'
        Write-Host ''
        Write-Host '  3) Skip ATW entirely and see only the Medusa storefront:'
        Write-Host ''
        Write-Host '       docker compose up medusa_postgres medusa_redis medusa_backend medusa_storefront'
        Write-Host ''
        Write-Host '────────────────────────────────────────────────────────────────' -ForegroundColor Yellow
        exit 1
    }
}

function Invoke-StageWidget {
    $dst = 'demo\medusa\storefront\public'
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    if ((Test-Path 'dist\widget.js') -and (Test-Path 'dist\widget.css')) {
        Copy-Item -Force 'dist\widget.js'  (Join-Path $dst 'widget.js')
        Copy-Item -Force 'dist\widget.css' (Join-Path $dst 'widget.css')
        Write-Host '[stage-widget] copied real widget bundle into demo/medusa/storefront/public/'
    }
    else {
        Set-Content -Path (Join-Path $dst 'widget.js') `
            -Value '/* widget bundle not built yet — run /atw.build to replace this stub */'
        Set-Content -Path (Join-Path $dst 'widget.css') `
            -Value '/* widget css stub */'
        Write-Host '[stage-widget] real bundle not found in dist/ — wrote placeholder stubs.'
        Write-Host "[stage-widget] After /atw.build finishes, re-run '.\scripts\make.ps1 stage-widget' then"
        Write-Host "[stage-widget] 'docker compose build medusa_storefront; docker compose up -d medusa_storefront'."
    }
}

function Invoke-Fresh {
    Invoke-StageWidget
    Invoke-Docker compose down -v

    if (Test-Path 'demo\atw-shop-host\.atw\state') {
        Remove-Item -Recurse -Force 'demo\atw-shop-host\.atw\state\*' -ErrorAction SilentlyContinue
    }

    # The publishable key is minted by the backend seed on first boot and
    # baked into the storefront bundle. We wipe it here so a true `fresh`
    # resets both halves in sync.
    $runtimeDir = 'demo\medusa\.runtime'
    if (Test-Path $runtimeDir) {
        Remove-Item -Recurse -Force $runtimeDir -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

    Write-Host ''
    Write-Host '[fresh] phase 1/2: rebuilding + bringing postgres + redis + medusa backend up (seed + PK export)...'
    Invoke-Docker compose build medusa_backend
    Invoke-Docker compose up medusa_postgres medusa_redis medusa_backend -d --wait

    $pkFile = Join-Path $runtimeDir 'publishable-key.txt'
    $deadline = (Get-Date).AddMinutes(5)
    while (-not (Test-Path $pkFile) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
    }
    if (-not (Test-Path $pkFile)) {
        throw "[fresh] timed out waiting for $pkFile — check 'docker compose logs medusa_backend' for seed errors."
    }
    $pk = (Get-Content $pkFile -Raw).Trim()
    if (-not $pk) {
        throw "[fresh] publishable key file is empty — seed likely failed."
    }
    Write-Host ''
    Write-Host "[fresh] publishable key captured: $pk"

    Write-Host ''
    Write-Host '[fresh] phase 2/2: bringing nginx storefront up (PK injected at container start)...'
    $env:MEDUSA_PUBLISHABLE_KEY = $pk
    Invoke-Docker compose up medusa_storefront -d --wait

    Write-Host ''
    Write-Host 'Medusa backend:      http://localhost:9000'
    Write-Host 'Aurelia storefront:  http://localhost:8000'
    Write-Host 'ATW runtime is NOT started. Next:'
    Write-Host '  cd demo\atw-shop-host; claude'
    Write-Host '  > /atw.init  /atw.brief  /atw.schema  /atw.api  /atw.plan  /atw.build  /atw.embed'
    Write-Host 'Then, after /atw.build produces dist/widget.{js,css}:'
    Write-Host '  .\scripts\make.ps1 stage-widget'
    Write-Host '  docker compose build medusa_storefront'
    Write-Host "  `$env:MEDUSA_PUBLISHABLE_KEY='$pk'; docker compose up -d medusa_storefront"
    Write-Host '  docker compose up atw_postgres atw_backend -d --wait'
}

function Invoke-Demo {
    Invoke-CheckEnv
    Invoke-CheckImage
    Invoke-StageWidget
    Invoke-Docker compose pull --ignore-pull-failures medusa_postgres medusa_redis atw_postgres
    Invoke-Docker compose up -d --wait
    Write-Host ''
    Write-Host 'Aurelia storefront:  http://localhost:8000'
    Write-Host 'ATW backend:         http://localhost:3100/health'
}

switch ($Target) {
    'help'          { Show-Help }
    'check-env'     { Invoke-CheckEnv }
    'check-image'   { Invoke-CheckImage }
    'stage-widget'  { Invoke-StageWidget }
    'fresh'         { Invoke-Fresh }
    'demo'          { Invoke-Demo }
    'seed'          { Invoke-Docker compose exec medusa_backend npm run seed }
    'down'          { Invoke-Docker compose down }
    'logs'          { Invoke-Docker compose logs -f }
    'test'          { & npx.cmd vitest run; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
}
