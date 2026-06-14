#Requires -Version 5
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

function Header($msg) {
    Write-Host ""
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host ""
}
function Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Err($msg)  { Write-Host "  [!!] $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "  [..] $msg" -ForegroundColor Yellow }

Clear-Host
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host "   VTT — Anima Beyond Fantasy  |  GM Launcher  " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor DarkCyan

# ── 0. Check Tailscale ────────────────────────────────────────────────────────
if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
    Err "Tailscale is not installed."
    Err "Run setup-tailscale.ps1 first (right-click → Run as Administrator)."
    Read-Host "  Press Enter to exit"; exit 1
}
$tsState = tailscale status --json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
if (-not $tsState -or $tsState.BackendState -ne "Running") {
    Err "Tailscale is not running or not logged in."
    Err "Open the Tailscale tray icon, sign in, then try again."
    Read-Host "  Press Enter to exit"; exit 1
}
$dnsName    = $tsState.Self.DNSName.TrimEnd('.')
$sessionUrl = "https://$dnsName"
Ok "Tailscale: $dnsName"

# ── Detect runtime: Docker (preferred) or Maven fallback ──────────────────────
$useDocker = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose version 2>$null | Out-Null
    $useDocker = ($LASTEXITCODE -eq 0)
}

$serverProcess = $null   # holds the Maven powershell PID when not using Docker

# ── 1. Build + Start server ───────────────────────────────────────────────────
if ($useDocker) {
    Header "1/2  Building and starting via Docker..."
    Info "Running: docker compose up --build -d"
    Push-Location $Root
    try {
        docker compose up --build -d
        if ($LASTEXITCODE -ne 0) { throw "docker compose up failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
    Ok "Container started."
} else {
    Info "Docker not found — using Maven directly."

    Header "1/3  Building frontend..."
    Push-Location "$Root\client"
    try {
        pnpm build:web
        if ($LASTEXITCODE -ne 0) { throw "pnpm build:web failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
    Ok "Frontend built."

    Header "2/3  Starting Spring Boot..."
    $jdk25 = "C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot"
    $serverCmd = "Set-Location '$Root\Server'; `$env:JAVA_HOME = '$jdk25'; Write-Host '-- Spring Boot --' -ForegroundColor Cyan; .\mvnw.cmd spring-boot:run"
    $serverProcess = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", $serverCmd `
        -PassThru -WindowStyle Normal
    Info "Server window opened (PID $($serverProcess.Id))."
}

# ── Wait for server to answer ─────────────────────────────────────────────────
$step = if ($useDocker) { "2/2" } else { "3/3" }
Header "$step  Waiting for server..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
        $null = Invoke-WebRequest "http://localhost:1000/api/campaigns" `
            -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        $ready = $true; break
    } catch { Write-Host "." -NoNewline }
}
Write-Host ""
if (-not $ready) {
    Err "Server did not start within 120 s."
    if ($useDocker) { docker compose logs --tail 40 }
    Read-Host "  Press Enter to exit"; exit 1
}
Ok "Server ready at http://localhost:1000"

# ── Open Tailscale Funnel ────────────────────────────────────────────────────
Header "Opening Tailscale Funnel..."
tailscale funnel 1000
if ($LASTEXITCODE -ne 0) {
    Err "Could not start Tailscale Funnel."
    Err "Re-run setup-tailscale.ps1 if you haven't enabled Funnel in the admin console."
    if ($useDocker) { docker compose down 2>$null | Out-Null }
    elseif ($serverProcess -and -not $serverProcess.HasExited) {
        & taskkill /F /T /PID $serverProcess.Id 2>$null | Out-Null
    }
    Read-Host "  Press Enter to exit"; exit 1
}
Ok "Funnel active."

# ── Display URL ───────────────────────────────────────────────────────────────
$bar = "=" * ($sessionUrl.Length + 8)
Write-Host ""
Write-Host "  $bar" -ForegroundColor Cyan
Write-Host "   Share this URL with your players:" -ForegroundColor White
Write-Host ""
Write-Host "     $sessionUrl" -ForegroundColor Green
Write-Host ""
Write-Host "   Stable URL — same every session, no warning page." -ForegroundColor Gray
Write-Host "  $bar" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor DarkGray
Write-Host ""

# ── Keep alive until Ctrl+C ───────────────────────────────────────────────────
try {
    while ($true) { Start-Sleep -Seconds 10 }
} finally {
    Write-Host ""
    Info "Shutting down..."
    try { tailscale funnel off 2>$null | Out-Null } catch {}

    if ($useDocker) {
        Push-Location $Root
        try { docker compose down 2>$null | Out-Null } finally { Pop-Location }
    } elseif ($serverProcess -and -not $serverProcess.HasExited) {
        & taskkill /F /T /PID $serverProcess.Id 2>$null | Out-Null
    }

    Ok "Done. Session ended."
    Write-Host ""
}
