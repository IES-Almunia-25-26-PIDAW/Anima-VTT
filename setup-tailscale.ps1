#Requires -Version 5
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Err($m)  { Write-Host "  [!!] $m" -ForegroundColor Red }
function Info($m) { Write-Host "  [..] $m" -ForegroundColor Yellow }
function Hdr($m)  { Write-Host ""; Write-Host "  $m" -ForegroundColor Cyan; Write-Host "" }

Clear-Host
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host "   VTT — Tailscale One-Time Setup              " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor DarkCyan

# ── 1. Install Tailscale ──────────────────────────────────────────────────────
Hdr "1/3  Installing Tailscale..."

if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    Ok "Tailscale already installed: $(tailscale version)"
} else {
    # Prefer winget (ships with Windows 11); fall back to direct MSI download.
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Info "Installing via winget..."
        winget install --id Tailscale.Tailscale --silent `
            --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw "winget install failed." }
    } else {
        Info "winget not available — downloading MSI installer..."
        $msi = "$env:TEMP\tailscale-setup.exe"
        Invoke-WebRequest "https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.exe" `
            -OutFile $msi -UseBasicParsing
        Start-Process $msi -ArgumentList "/S" -Wait
    }

    # Refresh PATH so the new tailscale.exe is found immediately
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")

    if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
        # Fallback: add the common install path manually
        $env:PATH += ";$env:ProgramFiles\Tailscale"
    }

    Ok "Tailscale installed."
}

# ── 2. Log in ─────────────────────────────────────────────────────────────────
Hdr "2/3  Logging in to Tailscale..."

$state = (tailscale status --json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue)
if ($state -and $state.BackendState -eq "Running") {
    Ok "Already logged in as: $($state.Self.DNSName.TrimEnd('.'))"
} else {
    Info "Opening Tailscale login in your browser..."
    tailscale login
    # Poll until the daemon reports Running
    Info "Waiting for login to complete..."
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 3
        $state = (tailscale status --json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue)
        Write-Host "." -NoNewline
    } while ((-not $state -or $state.BackendState -ne "Running") -and (Get-Date) -lt $deadline)
    Write-Host ""
    if (-not $state -or $state.BackendState -ne "Running") {
        Err "Login timed out. Re-run this script after logging in."
        exit 1
    }
    Ok "Logged in as: $($state.Self.DNSName.TrimEnd('.'))"
}

# ── 3. Enable HTTPS certificates + Funnel ────────────────────────────────────
Hdr "3/3  Enabling Funnel..."

Write-Host "  Tailscale Funnel requires two settings to be enabled" -ForegroundColor White
Write-Host "  in your Tailscale admin console (one-time, ~30 seconds):" -ForegroundColor White
Write-Host ""
Write-Host "    1. Open: https://login.tailscale.com/admin/dns" -ForegroundColor Yellow
Write-Host "       Enable 'HTTPS Certificates'" -ForegroundColor Yellow
Write-Host ""
Write-Host "    2. Open: https://login.tailscale.com/admin/acls" -ForegroundColor Yellow
Write-Host "       Add this stanza to your ACL policy JSON:" -ForegroundColor Yellow
Write-Host ""
Write-Host '       "nodeAttrs": [{ "target": ["*"], "attr": ["funnel"] }]' -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Enter once you have done both steps..." -ForegroundColor DarkGray
$null = Read-Host

# Verify funnel actually works by running a quick test
Info "Testing Tailscale Funnel..."
$testResult = tailscale funnel status 2>&1
if ($LASTEXITCODE -ne 0) {
    Err "Funnel check failed. Make sure you completed both admin steps above."
    Write-Host "  Output: $testResult" -ForegroundColor DarkGray
    Read-Host "  Press Enter to exit"
    exit 1
}

$dnsName = $state.Self.DNSName.TrimEnd('.')
$funnelUrl = "https://$dnsName"

Write-Host ""
Write-Host "================================================" -ForegroundColor DarkCyan
Ok "Setup complete!"
Write-Host ""
Write-Host "  Your permanent session URL will be:" -ForegroundColor White
Write-Host "  $funnelUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  Share that URL with your players each session." -ForegroundColor White
Write-Host "  Double-click start-gm.bat to begin a session." -ForegroundColor White
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host ""
Read-Host "  Press Enter to close"
