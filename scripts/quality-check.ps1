$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Push-Location "$root\backend"
try {
  $goFiles = Get-ChildItem -Recurse -Filter '*.go' -File
  if ($goFiles.Count -gt 0) {
    $unformatted = @(gofmt -l $goFiles.FullName)

    if ($LASTEXITCODE -ne 0) {
      throw 'gofmt check failed.'
    }

    if ($unformatted.Count -gt 0) {
      Write-Host 'The following Go files require gofmt:' -ForegroundColor Yellow
      $unformatted | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Yellow
      }

      throw 'Go formatting check failed.'
    }
  }
  go test ./...
  if ($LASTEXITCODE -ne 0) { throw 'go test failed.' }
  go vet ./...
  if ($LASTEXITCODE -ne 0) { throw 'go vet failed.' }
  $tmpBinary = Join-Path $env:TEMP 'badminton-api-quality-check.exe'
  go build -o $tmpBinary ./cmd/api
  if ($LASTEXITCODE -ne 0) { throw 'go build failed.' }
  Remove-Item -LiteralPath $tmpBinary -Force -ErrorAction SilentlyContinue
} finally {
  Pop-Location
}

Push-Location "$root\frontend"
try {
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'frontend build failed.' }
} finally {
  Pop-Location
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker compose -f "$root\docker-compose.yml" config | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'docker compose config failed.' }
} else {
  Write-Warning 'Docker not found; compose validation skipped.'
}

Write-Host 'Quality checks passed.' -ForegroundColor Green
