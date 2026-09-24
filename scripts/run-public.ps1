param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,
  [switch]$Tunnel
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$demoEnv = Join-Path $root '.env.demo.local'
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop/Docker Engine with Compose v2 is required.'
}

# Persist generated demo secrets so an existing PostgreSQL volume keeps the same
# password across restarts. The file is ignored by Git.
if (-not (Test-Path $demoEnv)) {
  $jwtSecret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
  $postgresPassword = [guid]::NewGuid().ToString('N') + 'Db9'
  @(
    "JWT_SECRET=$jwtSecret"
    "POSTGRES_PASSWORD=$postgresPassword"
  ) | Set-Content -Path $demoEnv -Encoding ascii
  Write-Host 'Created .env.demo.local with persistent local demo secrets (Git ignored).' -ForegroundColor DarkGray
}

$env:PUBLIC_PORT = "$Port"
docker compose --env-file $demoEnv up -d --build
if ($LASTEXITCODE -ne 0) {
  throw 'docker compose failed.'
}

$readyUrl = "http://127.0.0.1:$Port/ready"
$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $readyUrl -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $ready) {
  docker compose --env-file $demoEnv ps
  throw "Application did not become ready at $readyUrl. Run 'docker compose --env-file .env.demo.local logs backend' for details."
}

$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "`nBadminton Court Management Platform is ready:" -ForegroundColor Green
Write-Host "  Local:  http://localhost:$Port"
if ($ip) { Write-Host "  LAN:    http://${ip}:$Port" }
Write-Host "  Health: http://localhost:$Port/ready"
Write-Host '  Stop:   docker compose --env-file .env.demo.local down'
Write-Host ''

if ($Tunnel) {
  if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    throw 'cloudflared was not found. Install Cloudflare Tunnel first or run without -Tunnel.'
  }
  Write-Host 'Starting a temporary public HTTPS tunnel. Keep this terminal open.' -ForegroundColor Yellow
  cloudflared tunnel --url "http://localhost:$Port"
}
