<#
.SYNOPSIS
    Bootstrap vis on Windows — installs a version manager (if needed),
    Node LTS, and @visulima/vis in one step.

.DESCRIPTION
    One-liner bootstrap for new users on Windows who may not have Node,
    npm, or any version manager installed:

        irm https://raw.githubusercontent.com/visulima/visulima/main/packages/tooling/vis/scripts/install.ps1 | iex

    To pass arguments, use the scriptblock form:

        & ([scriptblock]::Create((irm '<url>/install.ps1'))) -Manager proto -Yes

    The script:

        1. Detects an existing Node on PATH. If none is found, installs
           proto / fnm / volta (proto is the default) via the vendor's
           official PowerShell / winget installer.
        2. Uses the chosen manager to install Node LTS.
        3. Installs @visulima/vis globally via pnpm (if available) or npm.
        4. Runs `vis toolchain install` when the current directory has
           workspace pin files (.nvmrc, .prototools, etc.).

    Requires PowerShell 5.1 or newer. Native Windows only — for WSL,
    use install.sh instead.

.PARAMETER Manager
    Preferred manager when no Node exists. Must be one of: proto (default),
    fnm, volta. mise and nvm are not supported on native Windows.

.PARAMETER Yes
    Non-interactive; skip all prompts and proceed with defaults.

.PARAMETER NoToolchainInstall
    Skip `vis toolchain install` after the package is installed.

.PARAMETER Version
    Pin a specific vis version (default: latest).

.PARAMETER Help
    Show this help and exit.
#>

[CmdletBinding()]
param(
    [ValidateSet("proto", "fnm", "volta")]
    [string]$Manager = "proto",
    [switch]$Yes,
    [switch]$NoToolchainInstall,
    [string]$Version = "latest",
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Output helpers ──────────────────────────────────────────────────

function Write-Info   ($m) { Write-Host ("info:  " + $m)  -ForegroundColor Blue }
function Write-Warn   ($m) { Write-Host ("warn:  " + $m)  -ForegroundColor Yellow }
function Write-Err    ($m) { Write-Host ("error: " + $m)  -ForegroundColor Red }
function Write-Ok     ($m) { Write-Host ("✓ "    + $m)    -ForegroundColor Green }
function Write-Dim    ($m) { Write-Host $m                 -ForegroundColor DarkGray }

if ($Help) {
    @'
vis install script — bootstrap Node + vis from scratch (Windows)

Usage:
  irm <url>/install.ps1 | iex
  & ([scriptblock]::Create((irm '<url>/install.ps1'))) -Manager proto -Yes

Parameters:
  -Manager <name>          proto (default), fnm, volta. mise/nvm not supported on Windows.
  -Yes                     Non-interactive; skip prompts.
  -NoToolchainInstall      Skip `vis toolchain install` after install.
  -Version <spec>          Pin a specific vis version (default: latest).
  -Help                    Show this help.

Requires PowerShell 5.1+. For WSL, use install.sh instead.
'@ | Write-Host
    exit 0
}

# ── Helpers ─────────────────────────────────────────────────────────

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Confirm-Action($Message) {
    if ($Yes -or -not [Environment]::UserInteractive) {
        return $true
    }

    $answer = Read-Host "$Message [y/N]"

    return ($answer -match '^(y|yes)$')
}

# Persistent PATH updates need to hit the user registry; session
# updates just modify $env:PATH. We do both so the fresh install is
# usable in the current session without reopening PowerShell.
function Add-ToSessionPath([string]$Dir) {
    if (-not (Test-Path $Dir)) { return }
    if (($env:PATH -split ';') -contains $Dir) { return }

    $env:PATH = "$Dir;$env:PATH"
}

# ── Main flow ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "vis" -ForegroundColor White -NoNewline
Write-Host " — bootstrap installer (Windows)"
Write-Host ""

# 1. Node detection
if (Test-Command node) {
    $nodeVersion = (& node --version) -replace '^v', ''

    Write-Ok "Node $nodeVersion detected on PATH — skipping runtime install."
}
else {
    Write-Warn "No Node detected on PATH."
    Write-Info "vis needs Node >= 18 to run. Bootstrap options:"
    Write-Host "  1. proto (recommended — multi-language, reads .prototools / .nvmrc / engines.node)"
    Write-Host "  2. fnm   (Node only, fastest shell activation)"
    Write-Host "  3. volta (Node + JS package managers, package.json-driven)"
    Write-Host ""

    # Interactive choice overrides -Manager unless -Yes is set.
    if (-not $Yes -and [Environment]::UserInteractive) {
        $choice = Read-Host "Which would you like to install? [1-3, default: 1]"

        switch ($choice) {
            '2' { $Manager = 'fnm' }
            '3' { $Manager = 'volta' }
            default { $Manager = 'proto' }
        }
    }

    if (-not (Confirm-Action "Install $Manager and use it to install Node LTS?")) {
        Write-Err "Aborted. Install Node manually (nodejs.org) or choose a different manager via -Manager."
        exit 1
    }

    switch ($Manager) {
        'proto' {
            Write-Info "Installing proto via https://moonrepo.dev/install/proto.ps1..."
            Invoke-RestMethod -Uri 'https://moonrepo.dev/install/proto.ps1' | Invoke-Expression
            Add-ToSessionPath "$env:USERPROFILE\.proto\bin"
            Add-ToSessionPath "$env:USERPROFILE\.proto\shims"
        }
        'fnm' {
            if (Test-Command winget) {
                Write-Info "Installing fnm via winget (Schniz.fnm)..."
                & winget install --id Schniz.fnm --source winget --silent --accept-package-agreements --accept-source-agreements
            }
            elseif (Test-Command scoop) {
                Write-Info "Installing fnm via scoop..."
                & scoop install fnm
            }
            else {
                Write-Err "Neither winget nor scoop is available. Install one first, or choose -Manager proto."
                exit 1
            }

            # fnm installs into the user's standard package-manager
            # location, which is already on PATH after the install
            # exits, but we prod a session refresh just in case.
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
        }
        'volta' {
            if (Test-Command winget) {
                Write-Info "Installing volta via winget (Volta.Volta)..."
                & winget install --id Volta.Volta --source winget --silent --accept-package-agreements --accept-source-agreements
            }
            elseif (Test-Command scoop) {
                Write-Info "Installing volta via scoop..."
                & scoop install volta
            }
            else {
                Write-Err "Neither winget nor scoop is available. Install one (or download volta from https://volta.sh) and re-run, or choose -Manager proto."
                exit 1
            }

            Add-ToSessionPath "$env:USERPROFILE\.volta\bin"
            Add-ToSessionPath "$env:LOCALAPPDATA\Volta\bin"
        }
    }

    # Install Node LTS via the chosen manager.
    Write-Info "Installing Node LTS via $Manager..."

    switch ($Manager) {
        'proto' {
            & proto install node lts
            & proto install npm
        }
        'fnm' {
            & fnm install --lts
            & fnm default 'lts-latest'

            # Apply fnm env so `node` resolves in this session.
            $fnmEnv = & fnm env --use-on-cd | Out-String

            Invoke-Expression $fnmEnv
        }
        'volta' {
            & volta install 'node@lts'
        }
    }

    if (-not (Test-Command node)) {
        Write-Err "Node is still not on PATH after installing $Manager."
        Write-Err "Open a new PowerShell window and re-run this script. (The current session may need the updated PATH.)"
        exit 1
    }

    Write-Ok "Node $(& node --version) installed via $Manager."
}

# 2. Install vis globally.
$pm = if (Test-Command pnpm) { 'pnpm' } elseif (Test-Command npm) { 'npm' } else { $null }

if (-not $pm) {
    Write-Err "Neither pnpm nor npm is on PATH after Node install. Aborting."
    exit 1
}

$pkgSpec = if ($Version -eq 'latest') { '@visulima/vis' } else { "@visulima/vis@$Version" }

Write-Info "Installing $pkgSpec globally via $pm..."

switch ($pm) {
    'pnpm' { & pnpm add -g $pkgSpec }
    'npm'  { & npm install -g $pkgSpec }
}

if (-not (Test-Command vis)) {
    Write-Err "vis is installed but not on PATH. Check your global bin directory (``npm config get prefix``)."
    exit 1
}

$visVersion = try { (& vis --version) 2>$null } catch { '?' }

Write-Ok "vis $visVersion installed."

# 3. Optional: toolchain install when we're inside a workspace.
if (-not $NoToolchainInstall) {
    $markers = @('.nvmrc', '.node-version', '.prototools', '.mise.toml', '.tool-versions', 'vis.config.ts', 'vis.config.js')
    $found = $null
    $searchDir = (Get-Location).Path

    # Walk up to the git root (or filesystem root) looking for any pin file.
    while ($searchDir -and $searchDir -ne [System.IO.Path]::GetPathRoot($searchDir)) {
        foreach ($marker in $markers) {
            $candidate = Join-Path $searchDir $marker

            if (Test-Path -Path $candidate) {
                $found = $candidate
                break
            }
        }

        if ($found) { break }

        if (Test-Path -Path (Join-Path $searchDir '.git')) { break }

        $searchDir = Split-Path -Path $searchDir -Parent
    }

    if ($found) {
        Write-Info "Found $found — running ``vis toolchain install``..."

        try {
            & vis toolchain install

            if ($LASTEXITCODE -eq 0) {
                Write-Ok "Workspace toolchain matches all pins."
            }
            else {
                Write-Warn "``vis toolchain install`` exited with code $LASTEXITCODE. Check the output above."
            }
        }
        catch {
            Write-Warn "``vis toolchain install`` failed: $_"
        }
    }
    else {
        Write-Dim "(skipping ``vis toolchain install`` — no workspace pin files found)"
    }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Dim "  vis doctor            — full project health check"
Write-Dim "  vis toolchain status  — report tool versions"
Write-Dim "  vis run build         — run a workspace target"
Write-Host ""
