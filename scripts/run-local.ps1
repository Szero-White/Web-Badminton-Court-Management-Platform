param(
    [string]$SourcePath = "D:\Study\Web Badminton Court Management Platform",
    [int]$BackendPort = 8080,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

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
    } catch {
        return $false
    }
}

$backend = Join-Path $SourcePath "backend"
$frontend = Join-Path $SourcePath "frontend"

if (-not (Test-Path -LiteralPath (Join-Path $backend ".env"))) {
    throw "backend\.env not found. Run SETUP_AND_RUN_LOCAL_POSTGRES.ps1 first."
}

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    throw "Go is not available in PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not available in PATH."
}

Write-Host ""
Write-Host "Badminton Court Management - Local Development" -ForegroundColor Cyan
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
}
else {
    Write-Host "[INFO] Backend port $BackendPort is already in use." -ForegroundColor Yellow
}

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

npm run dev -- --host 0.0.0.0 --port $FrontendPort

Write-Host ''
Write-Host 'Frontend stopped. Press Enter to close.' -ForegroundColor Yellow
Read-Host
"@

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $frontendCommand
    ) | Out-Null
}
else {
    Write-Host "[INFO] Frontend port $FrontendPort is already in use." -ForegroundColor Yellow
}

Write-Host "Waiting for backend..." -ForegroundColor Cyan

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

if ($backendReady) {
    Write-Host "[OK] Backend ready" -ForegroundColor Green
}
else {
    Write-Host "[WARN] Backend is not ready. Check the Backend window." -ForegroundColor Yellow
}

$frontendReady = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Test-Port $FrontendPort) {
        $frontendReady = $true
        break
    }
    Start-Sleep -Seconds 1
}

if ($frontendReady) {
    Write-Host "[OK] Frontend ready" -ForegroundColor Green
    Start-Process "http://localhost:$FrontendPort"
}
else {
    Write-Host "[WARN] Frontend is not ready. Check the Frontend window." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Demo accounts:" -ForegroundColor Cyan
Write-Host "Admin    : admin@badminton.demo / Admin@12345"
Write-Host "Staff    : staff@badminton.demo / Staff@12345"
Write-Host "Customer : customer@badminton.demo / Customer@12345"
Write-Host ""
Write-Host "Stop: Ctrl+C in the Backend and Frontend windows." -ForegroundColor Yellow