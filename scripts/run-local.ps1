param(
    [string]$SourcePath = "",
    [int]$BackendPort = 8080,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SourcePath)) {
    $SourcePath = Split-Path -Parent $PSScriptRoot
}

function Test-Port([int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(500, $false)
        if ($ok) {
            $client.EndConnect($iar)
        }
        $client.Close()
        return $ok
    }
    catch {
        return $false
    }
}

function Require-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is not available in PATH. $InstallHint"
    }
}

$backend = Join-Path $SourcePath "backend"
$frontend = Join-Path $SourcePath "frontend"
$backendEnv = Join-Path $backend ".env"
$frontendEnv = Join-Path $frontend ".env"

foreach ($required in @(
    (Join-Path $backend "go.mod"),
    (Join-Path $frontend "package.json")
)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required project file not found: $required"
    }
}

if (-not (Test-Path -LiteralPath $backendEnv)) {
    throw "Local backend configuration is missing. Run '.\scripts\setup-local.ps1' from the repository root first."
}

if (-not (Test-Path -LiteralPath $frontendEnv)) {
    $frontendExample = Join-Path $frontend ".env.example"
    if (-not (Test-Path -LiteralPath $frontendExample)) {
        throw "frontend\.env and frontend\.env.example are both missing."
    }
    Copy-Item -LiteralPath $frontendExample -Destination $frontendEnv
}

Require-Command "go" "Install Go and restart the terminal."
Require-Command "npm" "Install Node.js/npm and restart the terminal."

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Badminton Court Management - Local Development" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Backend : http://localhost:$BackendPort"
Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Database: PostgreSQL local"
Write-Host ""

if (-not (Test-Port $BackendPort)) {
    $backendEscaped = $backend.Replace("'", "''")
    $backendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Badminton Backend'
Set-Location '$backendEscaped'
go run ./cmd/api
Write-Host ''
Write-Host 'Backend stopped. Press Enter to close.' -ForegroundColor Yellow
Read-Host
"@

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $backendCommand
    ) | Out-Null

    Write-Host "[START] Backend process launched" -ForegroundColor Cyan
}
else {
    Write-Host "[INFO] Backend port $BackendPort is already in use; reusing the existing process." -ForegroundColor Yellow
}

Write-Host "Waiting for backend readiness..." -ForegroundColor Cyan

$backendReady = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri "http://127.0.0.1:$BackendPort/ready" `
            -TimeoutSec 2

        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    }
    catch {}

    Start-Sleep -Seconds 1
}

if (-not $backendReady) {
    Write-Host "[ERROR] Backend did not become ready within 60 seconds." -ForegroundColor Red
    Write-Host "Check the 'Badminton Backend' PowerShell window for the actual error." -ForegroundColor Yellow
    Write-Host "Common causes: PostgreSQL service stopped, database missing, or incorrect credentials in backend\.env." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Backend ready" -ForegroundColor Green

if (-not (Test-Port $FrontendPort)) {
    $frontendEscaped = $frontend.Replace("'", "''")
    $frontendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Badminton Frontend'
Set-Location '$frontendEscaped'

if (-not (Test-Path '.\node_modules')) {
    npm ci
    if (`$LASTEXITCODE -ne 0) {
        throw 'npm ci failed'
    }
}

npm run dev -- --host 0.0.0.0 --port $FrontendPort --strictPort

Write-Host ''
Write-Host 'Frontend stopped. Press Enter to close.' -ForegroundColor Yellow
Read-Host
"@

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $frontendCommand
    ) | Out-Null

    Write-Host "[START] Frontend process launched" -ForegroundColor Cyan
}
else {
    Write-Host "[INFO] Frontend port $FrontendPort is already in use; reusing the existing process." -ForegroundColor Yellow
}

Write-Host "Waiting for frontend..." -ForegroundColor Cyan

$frontendReady = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Test-Port $FrontendPort) {
        $frontendReady = $true
        break
    }

    Start-Sleep -Seconds 1
}

if (-not $frontendReady) {
    Write-Host "[ERROR] Frontend did not become ready within 60 seconds." -ForegroundColor Red
    Write-Host "Check the 'Badminton Frontend' PowerShell window for the actual error." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Frontend ready" -ForegroundColor Green

Write-Host ""
Write-Host "Demo accounts:" -ForegroundColor Cyan
Write-Host "  Admin    : admin@badminton.demo / Admin@12345"
Write-Host "  Staff    : staff@badminton.demo / Staff@12345"
Write-Host "  Customer : customer@badminton.demo / Customer@12345"
Write-Host ""
Write-Host "Application: http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "API        : http://localhost:$BackendPort" -ForegroundColor Green
Write-Host "Stop       : Ctrl+C in the Backend and Frontend windows." -ForegroundColor Yellow
Write-Host ""

Start-Process "http://localhost:$FrontendPort"
