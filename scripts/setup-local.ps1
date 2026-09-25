param(
    [string]$SourcePath = "",
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432,
    [string]$PostgresUser = "postgres",
    [string]$PostgresDatabase = "badminton",
    [string]$PostgresPassword = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SourcePath)) {
    $SourcePath = Split-Path -Parent $PSScriptRoot
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Set-EnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    $lines = @()
    if (Test-Path -LiteralPath $Path) {
        $lines = @(Get-Content -LiteralPath $Path)
    }

    $pattern = "^\s*" + [Regex]::Escape($Key) + "\s*="
    $updated = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $pattern) {
            $lines[$i] = "$Key=$Value"
            $updated = $true
            break
        }
    }

    if (-not $updated) {
        $lines += "$Key=$Value"
    }

    [IO.File]::WriteAllLines(
        $Path,
        $lines,
        (New-Object Text.UTF8Encoding($false))
    )
}

function Find-Psql {
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $postgresRoot = "C:\Program Files\PostgreSQL"
    if (Test-Path -LiteralPath $postgresRoot) {
        $versions = Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending

        foreach ($version in $versions) {
            $candidate = Join-Path $version.FullName "bin\psql.exe"
            if (Test-Path -LiteralPath $candidate) {
                return $candidate
            }
        }
    }

    return $null
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "Project root not found: $SourcePath"
}

if ($PostgresDatabase -notmatch '^[A-Za-z0-9_]+$') {
    throw "PostgresDatabase may contain only letters, numbers, and underscores."
}

$backendPath = Join-Path $SourcePath "backend"
$frontendPath = Join-Path $SourcePath "frontend"
$backendEnvExample = Join-Path $backendPath ".env.example"
$frontendEnvExample = Join-Path $frontendPath ".env.example"
$backendEnv = Join-Path $backendPath ".env"
$frontendEnv = Join-Path $frontendPath ".env"

foreach ($required in @(
    (Join-Path $backendPath "go.mod"),
    (Join-Path $frontendPath "package.json"),
    $backendEnvExample,
    $frontendEnvExample
)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required project file not found: $required"
    }
}

if ([string]::IsNullOrWhiteSpace($PostgresPassword)) {
    $securePassword = Read-Host "Enter the local PostgreSQL password for '$PostgresUser'" -AsSecureString
    $credential = New-Object System.Management.Automation.PSCredential($PostgresUser, $securePassword)
    $PostgresPassword = $credential.GetNetworkCredential().Password
}

if ([string]::IsNullOrWhiteSpace($PostgresPassword)) {
    throw "PostgreSQL password cannot be empty."
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Badminton Platform - Local Environment Setup" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Project : $SourcePath"
Write-Host "Database: $PostgresHost`:$PostgresPort / $PostgresDatabase"

Write-Step "Creating local environment files"

if (-not (Test-Path -LiteralPath $backendEnv)) {
    Copy-Item -LiteralPath $backendEnvExample -Destination $backendEnv
    Write-Ok "Created backend\.env"
} else {
    Write-Ok "backend\.env already exists; updating local database settings"
}

if (-not (Test-Path -LiteralPath $frontendEnv)) {
    Copy-Item -LiteralPath $frontendEnvExample -Destination $frontendEnv
    Write-Ok "Created frontend\.env"
} else {
    Write-Ok "frontend\.env already exists"
}

Set-EnvValue $backendEnv "APP_ENV" "development"
Set-EnvValue $backendEnv "APP_PORT" "8080"
Set-EnvValue $backendEnv "POSTGRES_HOST" $PostgresHost
Set-EnvValue $backendEnv "POSTGRES_PORT" ([string]$PostgresPort)
Set-EnvValue $backendEnv "POSTGRES_USER" $PostgresUser
Set-EnvValue $backendEnv "POSTGRES_PASSWORD" $PostgresPassword
Set-EnvValue $backendEnv "POSTGRES_DB" $PostgresDatabase
Set-EnvValue $backendEnv "POSTGRES_SSLMODE" "disable"
Set-EnvValue $backendEnv "ALLOW_SQLITE_FALLBACK" "false"
Set-EnvValue $backendEnv "REQUIRE_REDIS" "false"
Set-EnvValue $backendEnv "DEMO_SEED_ENABLED" "true"

Set-EnvValue $frontendEnv "VITE_API_URL" "http://localhost:8080/api/v1"

Write-Ok "Local environment configured"

Write-Step "Checking PostgreSQL"

$psql = Find-Psql
if (-not $psql) {
    Write-Warning "psql.exe was not found."
    Write-Host ""
    Write-Host "The .env files are ready, but the database could not be created automatically." -ForegroundColor Yellow
    Write-Host "Create a PostgreSQL database named '$PostgresDatabase' in pgAdmin, then run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\run-local.ps1" -ForegroundColor Cyan
    exit 0
}

$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $PostgresPassword

try {
    & $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -tAc "SELECT 1;" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to authenticate to PostgreSQL. Check the service, username, password, host, and port."
    }

    Write-Ok "PostgreSQL authentication succeeded"

    $exists = (& $psql `
        -h $PostgresHost `
        -p $PostgresPort `
        -U $PostgresUser `
        -d postgres `
        -tAc "SELECT 1 FROM pg_database WHERE datname='$PostgresDatabase';").Trim()

    if ($exists -ne "1") {
        & $psql `
            -h $PostgresHost `
            -p $PostgresPort `
            -U $PostgresUser `
            -d postgres `
            -v ON_ERROR_STOP=1 `
            -c "CREATE DATABASE `"$PostgresDatabase`";"

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create database '$PostgresDatabase'."
        }

        Write-Ok "Created PostgreSQL database '$PostgresDatabase'"
    } else {
        Write-Ok "Database '$PostgresDatabase' already exists"
    }
}
finally {
    $env:PGPASSWORD = $previousPassword
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " LOCAL SETUP COMPLETED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File `".\scripts\run-local.ps1`""
Write-Host ""
Write-Host "Demo accounts will be seeded automatically on backend startup:" -ForegroundColor Cyan
Write-Host "  Admin    : admin@badminton.demo / Admin@12345"
Write-Host "  Staff    : staff@badminton.demo / Staff@12345"
Write-Host "  Customer : customer@badminton.demo / Customer@12345"
