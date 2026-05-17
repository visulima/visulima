<#
.SYNOPSIS
    Bootstrap vis on Windows -- installs the latest Node LTS (or a
    version manager on request) and @visulima/vis in one step.

.DESCRIPTION
    One-liner bootstrap for new users on Windows who may not have Node,
    npm, or any version manager installed:

        irm https://visulima.com/install.ps1 | iex

    To pass arguments, use the scriptblock form:

        & ([scriptblock]::Create((irm '<url>/install.ps1'))) -Manager proto -Yes

    The script:

        1. Detects an existing Node on PATH. If none is found, installs
           the latest Node LTS directly by default (winget/choco/scoop
           when they can provide it, otherwise the official nodejs.org
           zip into %USERPROFILE%\.vis\node). A version manager (proto/
           fnm/volta) is offered as an opt-in alternative rather than
           forced.
        2. Installs @visulima/vis globally via pnpm (if available) or npm.
        3. Runs `vis toolchain install` when the current directory has
           workspace pin files (.nvmrc, .prototools, etc.).

    Requires PowerShell 5.1 or newer. Native Windows only -- for WSL,
    use install.sh instead.

.PARAMETER Manager
    Use a version manager instead of a direct Node LTS install. Must be
    one of: proto, fnm, volta. mise and nvm are not supported on native
    Windows. Passing this implies the version-manager path.

.PARAMETER NodeMajor
    Pin a specific Node major for the direct-install path. Defaults to
    the latest LTS (or the VIS_NODE_MAJOR environment variable).

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
    # Default left at 0 ("resolve latest LTS"); VIS_NODE_MAJOR is parsed
    # and validated below so a non-numeric value yields a clear error
    # instead of an [int]-cast exception under Set-StrictMode.
    [int]$NodeMajor = 0,
    [switch]$Yes,
    [switch]$NoToolchainInstall,
    [string]$Version = "latest",
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# $NodeMajor 0 means "resolve the latest LTS at install time" (the
# default). VIS_NODE_MAJOR / -NodeMajor pins a specific major instead.
# The fallback is used only when LTS resolution can't reach nodejs.org.
$FallbackNodeMajor = 24

# True only when the user explicitly asked for a version manager (-Manager
# on the command line or VIS_MANAGER in the environment). Otherwise the
# default path installs Node directly; the manager is opt-in.
$ManagerExplicit = $PSBoundParameters.ContainsKey('Manager')

if ($env:VIS_MANAGER) {
    $Manager = $env:VIS_MANAGER
    $ManagerExplicit = $true
}

# -- Output helpers --------------------------------------------------

function Write-Info   ($m) { Write-Host ("info:  " + $m)  -ForegroundColor Blue }
function Write-Warn   ($m) { Write-Host ("warn:  " + $m)  -ForegroundColor Yellow }
function Write-Err    ($m) { Write-Host ("error: " + $m)  -ForegroundColor Red }
function Write-Ok     ($m) { Write-Host ("[ok]  " + $m)   -ForegroundColor Green }
function Write-Dim    ($m) { Write-Host $m                 -ForegroundColor DarkGray }

if ($Help) {
    @'
vis install script -- bootstrap Node LTS + vis from scratch (Windows)

Usage:
  irm <url>/install.ps1 | iex                                          # interactive, installs Node LTS + vis
  & ([scriptblock]::Create((irm '<url>/install.ps1'))) -Manager proto   # use a version manager instead

Parameters:
  -Manager <name>          Use a version manager instead of a direct Node LTS
                           install. One of: proto, fnm, volta. mise/nvm are
                           not supported on native Windows.
  -NodeMajor <int>         Pin a specific Node major for the direct-install
                           path (default: latest LTS).
  -Yes                     Non-interactive; skip prompts (installs Node LTS).
  -NoToolchainInstall      Skip `vis toolchain install` after install.
  -Version <spec>          Pin a specific vis version (default: latest).
  -Help                    Show this help.

Environment:
  VIS_NODE_MAJOR           Pin a specific Node major (default: latest LTS).

Requires PowerShell 5.1+. For WSL, use install.sh instead.
'@ | Write-Host
    exit 0
}

# -- Input validation ------------------------------------------------
#
# $Manager, $NodeMajor and $Version are user-controlled (parameters or
# env). They flow into download URLs, an npm package spec and rc-file
# writes, so reject anything outside a known-safe shape up front and
# fail closed rather than carrying a tainted value deeper in.

# -Manager is guarded by [ValidateSet], but the VIS_MANAGER env
# override above bypasses that, so re-check here.
if ($Manager -notin @('proto', 'fnm', 'volta')) {
    Write-Err "Invalid version manager: '$Manager'. Expected one of: proto, fnm, volta."
    exit 2
}

# VIS_NODE_MAJOR is only consulted when -NodeMajor wasn't passed
# explicitly. Parse it defensively so a non-numeric value gives a clear
# message instead of an [int]-cast exception.
if (-not $PSBoundParameters.ContainsKey('NodeMajor') -and $env:VIS_NODE_MAJOR) {
    $parsed = 0
    if (-not [int]::TryParse($env:VIS_NODE_MAJOR, [ref]$parsed)) {
        Write-Err "Invalid VIS_NODE_MAJOR: '$($env:VIS_NODE_MAJOR)'. Expected a positive integer (e.g. 22)."
        exit 2
    }
    $NodeMajor = $parsed
}

if ($NodeMajor -lt 0) {
    Write-Err "Invalid NodeMajor: '$NodeMajor'. Expected a positive integer (e.g. 22)."
    exit 2
}

# Allow letters, digits, '.', '-', '_' and '@' only: covers semver
# (1.2.3, 1.2.3-rc.1) and dist tags (latest, next, beta). Rejects shell
# metacharacters, slashes and whitespace that could smuggle a different
# package or command into `npm install -g @visulima/vis@<spec>`.
if ($Version -notmatch '^[A-Za-z0-9._@-]+$') {
    Write-Err "Invalid -Version: '$Version'. Expected a semver or dist-tag (e.g. 1.2.3, 1.2.3-rc.1, latest)."
    exit 2
}

# -- Helpers ---------------------------------------------------------

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

# -- Direct Node install (default path) ------------------------------

# Map the process architecture to Node's Windows dist arch slug.
function Get-NodeArch {
    switch ($env:PROCESSOR_ARCHITECTURE) {
        'AMD64' { 'x64' }
        'ARM64' { 'arm64' }
        'x86'   { 'x86' }
        default { '' }
    }
}

# Newest LTS major from nodejs.org's release index (0 on failure).
# index.json is newest-first; the first entry whose "lts" is a codename
# string (not the boolean false) is the latest LTS line.
function Resolve-LtsMajor {
    try {
        $json = (Invoke-WebRequest -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing).Content | ConvertFrom-Json
    }
    catch {
        return 0
    }

    foreach ($rel in $json) {
        if ($rel.lts -is [string]) {
            if ($rel.version -match '^v(\d+)\.') { return [int]$Matches[1] }
        }
    }

    return 0
}

# Ensure $script:NodeMajor is set: an explicit pin wins (non-zero),
# otherwise resolve the latest LTS, otherwise the static fallback.
function Resolve-NodeMajor {
    if ($NodeMajor -gt 0) { return }

    Write-Info "Resolving the latest Node LTS from nodejs.org..."
    $script:NodeMajor = Resolve-LtsMajor

    if ($NodeMajor -le 0) {
        $script:NodeMajor = $FallbackNodeMajor
        Write-Warn "Could not resolve the latest LTS -- falling back to Node $NodeMajor."
    }
}

# Major version of the `node` currently on PATH ($null when none).
function Get-CurrentNodeMajor {
    if (-not (Test-Command node)) { return $null }

    $v = try { (& node --version) 2>$null } catch { $null }

    if ($v -match '^v(\d+)') { return [int]$Matches[1] }

    return $null
}

# True when the `node` on PATH satisfies vis's engines range,
# ^22.14.0 || >=24.10.0 (kept in sync with package.json). When it does
# we skip the runtime install entirely.
function Test-NodeSupported {
    if (-not (Test-Command node)) { return $false }

    $v = try { (& node --version) 2>$null } catch { $null }

    if ($v -notmatch '^v(\d+)\.(\d+)\.(\d+)') { return $false }

    $maj = [int]$Matches[1]
    $min = [int]$Matches[2]

    # ^22.14.0 -> exactly major 22 and >= 22.14.0
    if ($maj -eq 22) { return ($min -ge 14) }

    # >=24.10.0 -> 24.10.0+, or any newer major (25+)
    if ($maj -gt 24) { return $true }
    if ($maj -eq 24) { return ($min -ge 10) }

    return $false
}

# Prepend a vis-owned bin dir to the persistent User PATH (idempotent)
# and to the current session so the fresh Node is usable immediately
# without reopening PowerShell.
function Add-ToUserPath([string]$Dir) {
    $userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $parts = if ($userPath) { $userPath -split ';' } else { @() }

    if ($parts -notcontains $Dir) {
        $newUserPath = if ($userPath) { "$Dir;$userPath" } else { $Dir }
        [System.Environment]::SetEnvironmentVariable("PATH", $newUserPath, "User")
    }

    Add-ToSessionPath $Dir
}

# Try winget / choco / scoop. Returns $true only when one of them ran a
# Node install successfully; the caller still re-checks the version. We
# add the install dir to the session PATH so the version re-check (and
# the rest of the script) can resolve `node` without a new shell.
function Install-NodeViaOsPkgMgr {
    if (Test-Command winget) {
        Write-Info "Installing Node LTS via winget (OpenJS.NodeJS.LTS)..."
        & winget install --id OpenJS.NodeJS.LTS --source winget --silent --accept-package-agreements --accept-source-agreements

        if ($LASTEXITCODE -eq 0) {
            Add-ToSessionPath "$env:ProgramFiles\nodejs"
            return $true
        }

        return $false
    }

    if (Test-Command choco) {
        Write-Info "Installing Node LTS via Chocolatey..."
        & choco install nodejs-lts -y

        if ($LASTEXITCODE -eq 0) {
            Add-ToSessionPath "$env:ProgramFiles\nodejs"
            return $true
        }

        return $false
    }

    if (Test-Command scoop) {
        Write-Info "Installing Node LTS via scoop..."
        & scoop install nodejs-lts

        if ($LASTEXITCODE -eq 0) {
            Add-ToSessionPath "$env:USERPROFILE\scoop\shims"
            return $true
        }

        return $false
    }

    return $false
}

# Fallback: official Node $NodeMajor zip into a vis-owned prefix,
# SHA256-verified. No admin rights, no version manager.
function Install-NodeViaZip {
    $arch = Get-NodeArch

    if (-not $arch) {
        Write-Err "No prebuilt Node $NodeMajor for Windows/$($env:PROCESSOR_ARCHITECTURE)."
        return $false
    }

    Write-Info "Resolving the latest Node $NodeMajor.x from nodejs.org..."

    $base = "https://nodejs.org/dist/latest-v$NodeMajor.x"

    try {
        $shasums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing).Content
    }
    catch {
        Write-Err "Could not reach nodejs.org to resolve Node $NodeMajor."
        return $false
    }

    $ver = $null
    foreach ($line in ($shasums -split "`n")) {
        if ($line -match 'node-v([0-9.]+)-win-') { $ver = $Matches[1]; break }
    }

    if (-not $ver) {
        Write-Err "Could not parse the Node version from SHASUMS256.txt."
        return $false
    }

    $file = "node-v$ver-win-$arch.zip"
    $want = $null
    foreach ($line in ($shasums -split "`n")) {
        $cols = ($line.Trim() -split '\s+')
        if ($cols.Count -ge 2 -and $cols[1] -eq $file) { $want = $cols[0]; break }
    }

    if (-not $want) {
        Write-Err "No checksum listed for $file (unsupported platform?)."
        return $false
    }

    $tmp = Join-Path $env:TEMP ("vis-node-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null

    try {
        $zip = Join-Path $tmp $file
        Write-Info "Downloading $file..."

        try {
            Invoke-WebRequest -Uri "$base/$file" -OutFile $zip -UseBasicParsing
        }
        catch {
            Write-Err "Download failed: $base/$file"
            return $false
        }

        $got = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()

        if ($got -ne $want.ToLower()) {
            Write-Err "Checksum mismatch for $file (expected $want, got $got)."
            return $false
        }

        $prefix = Join-Path $env:USERPROFILE ".vis\node"
        Write-Info "Installing Node $ver into $prefix..."

        if (Test-Path $prefix) { Remove-Item -Recurse -Force $prefix }
        New-Item -ItemType Directory -Path $prefix -Force | Out-Null

        Expand-Archive -Path $zip -DestinationPath $tmp -Force

        # The zip contains a single top-level node-v<ver>-win-<arch>\
        # dir; flatten it so node.exe lands at $prefix\node.exe.
        $inner = Join-Path $tmp "node-v$ver-win-$arch"
        Copy-Item -Path (Join-Path $inner '*') -Destination $prefix -Recurse -Force

        Add-ToUserPath $prefix

        return $true
    }
    finally {
        Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    }
}

# OS package manager first, nodejs.org zip as fallback.
function Install-NodeDirect {
    if (Install-NodeViaOsPkgMgr) {
        $maj = Get-CurrentNodeMajor

        if ($null -ne $maj -and $maj -ge $NodeMajor) {
            Write-Ok "Node $(& node --version) installed via the OS package manager."
            return $true
        }

        Write-Warn "OS package manager did not provide Node $NodeMajor -- falling back to nodejs.org."
    }
    else {
        Write-Info "OS package manager unavailable or unsuitable -- using the nodejs.org zip."
    }

    if (Install-NodeViaZip) {
        $nv = try { (& node --version) 2>$null } catch { "v$NodeMajor.x" }
        Write-Ok "Node $nv installed under %USERPROFILE%\.vis\node."
        return $true
    }

    return $false
}

# Install the chosen version manager and use it to install Node LTS.
# Throws on any failure so callers decide whether it's fatal (cold
# start) or just a warning (Node already works).
function Install-NodeViaManager([string]$mgr) {
    switch ($mgr) {
        'proto' {
            Write-Info "Installing proto via https://moonrepo.dev/install/proto.ps1..."
            # PSScriptAnalyzer disable=PSAvoidUsingInvokeExpression - vendor installer pattern (irm | iex), intentionally executed
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
                throw "Neither winget nor scoop is available. Install one first, or choose -Manager proto."
            }

            # fnm installs into the user's standard package-manager
            # location, already on PATH after install — but this process
            # didn't inherit the registry update. Refresh by APPENDING
            # User+Machine PATH to the session, then de-duplicate.
            $userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
            $machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
            $combined = "$env:PATH;$userPath;$machinePath"
            $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
            $deduped = ($combined -split ';' | Where-Object {
                if ([string]::IsNullOrWhiteSpace($_)) { return $false }
                return $seen.Add($_.TrimEnd('\'))
            }) -join ';'
            $env:PATH = $deduped
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
                throw "Neither winget nor scoop is available. Install one (or download volta from https://volta.sh) and re-run, or choose -Manager proto."
            }

            Add-ToSessionPath "$env:USERPROFILE\.volta\bin"
            Add-ToSessionPath "$env:LOCALAPPDATA\Volta\bin"
        }
    }

    Write-Info "Installing Node LTS via $mgr..."

    switch ($mgr) {
        'proto' {
            # `proto install <tool> lts` resolves the LTS alias. npm
            # ships with node, so no separate install step is needed.
            & proto install node lts
        }
        'fnm' {
            & fnm install --lts
            & fnm default 'lts-latest'

            # Apply fnm env so `node` resolves in this session.
            $fnmEnv = & fnm env --use-on-cd | Out-String

            # PSScriptAnalyzer disable=PSAvoidUsingInvokeExpression - fnm env emits PS exports we need to apply to this session
            Invoke-Expression $fnmEnv
        }
        'volta' {
            & volta install 'node@lts'
        }
    }
}

# Node already satisfies vis's range, but a version manager is still
# handy for per-project pinning. Offer it -- opt-in, and never fatal
# (the user's working Node must keep working).
function Invoke-VersionManagerOffer {
    $want = $false

    if ($ManagerExplicit) {
        $want = $true
    }
    elseif (-not $Yes -and [Environment]::UserInteractive) {
        if (Confirm-Action "Node is set. Also set up a version manager (proto / fnm / volta) for per-project tool versions?") {
            $want = $true
        }
    }

    if (-not $want) { return }

    $mgr = $Manager

    if (-not $ManagerExplicit -and -not $Yes -and [Environment]::UserInteractive) {
        Write-Host "  1. proto (recommended -- multi-language, reads .prototools / .nvmrc / engines.node)"
        Write-Host "  2. fnm   (Node only, fastest shell activation)"
        Write-Host "  3. volta (Node + JS package managers, package.json-driven)"
        Write-Host ""
        $choice = Read-Host "Which version manager? [1-3, default: 1]"

        switch ($choice) {
            '2' { $mgr = 'fnm' }
            '3' { $mgr = 'volta' }
            default { $mgr = 'proto' }
        }
    }

    Write-Info "Setting up $mgr (your existing Node stays available)..."

    try {
        Install-NodeViaManager $mgr
        Write-Ok "$mgr is set up. Open a new PowerShell window to start using it."
    }
    catch {
        Write-Warn "Could not set up ${mgr}: $($_.Exception.Message)"
        Write-Warn "Continuing with your existing Node."
    }
}

# -- Main flow -------------------------------------------------------

Write-Host ""
Write-Host "vis" -ForegroundColor White -NoNewline
Write-Host " -- bootstrap installer (Windows)"
Write-Host ""

# 1. Node detection
if (Test-NodeSupported) {
    $nodeVersion = (& node --version) -replace '^v', ''

    Write-Ok "Node $nodeVersion detected (satisfies vis's supported range) -- skipping runtime install."

    Invoke-VersionManagerOffer
}
else {
    if (Test-Command node) {
        Write-Warn "Node $(& node --version) is on PATH but doesn't satisfy vis's supported range."
    }
    else {
        Write-Warn "No Node detected on PATH."
    }

    Write-Info "vis requires Node ^22.14.0 || >=24.10.0."

    # Default: install the latest Node LTS directly. A version manager
    # is opt-in -- only when explicitly requested (-Manager /
    # VIS_MANAGER) or chosen at the prompt below. We no longer force it.
    $useManager = $false

    if ($ManagerExplicit) {
        $useManager = $true
    }
    elseif (-not $Yes -and [Environment]::UserInteractive) {
        Write-Host "  1. Install the latest Node LTS directly (recommended -- no extra tooling)"
        Write-Host "  2. Set up a version manager instead (proto / fnm / volta)"
        Write-Host ""
        $nodeChoice = Read-Host "How would you like to get Node? [1-2, default: 1]"

        if ($nodeChoice -eq '2') { $useManager = $true }
    }

    if (-not $useManager) {
        Resolve-NodeMajor

        if (-not (Confirm-Action "Install the latest Node LTS (v$NodeMajor.x) now?")) {
            Write-Err "Aborted. Re-run and choose a version manager, or install Node manually (nodejs.org)."
            exit 1
        }

        if (-not (Install-NodeDirect)) {
            Write-Err "Could not install Node $NodeMajor automatically."
            Write-Err "Install Node manually (https://nodejs.org) or re-run and choose a version manager."
            exit 1
        }

        if (-not (Test-Command node)) {
            Write-Err "Node installed but not on PATH in this session."
            Write-Err "Open a new PowerShell window and re-run this script."
            exit 1
        }
    }
    else {
        if (-not $ManagerExplicit -and -not $Yes -and [Environment]::UserInteractive) {
            Write-Host "  1. proto (recommended -- multi-language, reads .prototools / .nvmrc / engines.node)"
            Write-Host "  2. fnm   (Node only, fastest shell activation)"
            Write-Host "  3. volta (Node + JS package managers, package.json-driven)"
            Write-Host ""
            $choice = Read-Host "Which version manager? [1-3, default: 1]"

            switch ($choice) {
                '2' { $Manager = 'fnm' }
                '3' { $Manager = 'volta' }
                default { $Manager = 'proto' }
            }
        }

        if (-not (Confirm-Action "Install $Manager and use it to install Node LTS?")) {
            Write-Err "Aborted. Re-run and pick 'Install Node directly', or install Node manually (nodejs.org)."
            exit 1
        }

        try {
            Install-NodeViaManager $Manager
        }
        catch {
            Write-Err $_.Exception.Message
            exit 1
        }

        if (-not (Test-Command node)) {
            Write-Err "Node is still not on PATH after installing $Manager."
            Write-Err "Open a new PowerShell window and re-run this script. (The current session may need the updated PATH.)"
            exit 1
        }

        Write-Ok "Node $(& node --version) installed via $Manager."
    }
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
    $binHint = if ($pm -eq 'pnpm') { 'pnpm bin -g' } else { 'npm config get prefix' }
    Write-Err "vis is installed but not on PATH. Check your global bin directory (run: ``$binHint``)."
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
        Write-Info "Found $found -- running ``vis toolchain install``..."

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
        Write-Dim "(skipping ``vis toolchain install`` -- no workspace pin files found)"
    }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Dim "  vis doctor            -- full project health check"
Write-Dim "  vis toolchain status  -- report tool versions"
Write-Dim "  vis run build         -- run a workspace target"
Write-Host ""
