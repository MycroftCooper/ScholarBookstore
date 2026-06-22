param(
  [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$goCache = Join-Path $root ".codex-runtime\go-build"
New-Item -ItemType Directory -Force -Path $goCache | Out-Null
$env:GOCACHE = $goCache

Push-Location (Join-Path $root "services\api")
try {
  go test ./...
}
finally {
  Pop-Location
}

if (-not $SkipWeb) {
  Push-Location (Join-Path $root "apps\web")
  try {
    npm.cmd run typecheck
  }
  finally {
    Pop-Location
  }
}

& (Join-Path $PSScriptRoot "check-encoding.ps1")
