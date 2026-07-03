#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# vis install script
#
# One-liner bootstrap for new users who may not have Node, npm, or any
# version manager on the machine:
#
#   curl -fsSL https://visulima.com/install.sh | bash
#
# The script:
#
#   1. Detects an existing Node on PATH. If none is found, installs
#      the latest Node LTS directly by default (OS package manager
#      when it can provide it, otherwise the official nodejs.org
#      tarball into ~/.vis/node). A version manager (proto/fnm/mise/
#      volta) is offered as an opt-in alternative rather than forced.
#   2. Installs @visulima/vis globally via the detected / freshly-
#      installed package manager (npm by default).
#   3. Optionally runs `vis toolchain install` when the current
#      directory (or a parent) has a vis / .nvmrc / .prototools workspace.
#
# Supports Linux and macOS. Windows users should run `npm install -g
# @visulima/vis` from a shell where Node is already available — the
# script paths below assume POSIX.
#
# Flags (usage: `curl ... | bash -s -- <flag>`):
#
#   --manager=proto|fnm|mise|volta   Use a version manager instead of a
#                                    direct Node LTS install.
#   --no-toolchain-install           Skip `vis toolchain install` after install.
#   --yes                            Non-interactive; assume "yes" to prompts
#                                    (installs the latest Node LTS).
#   --version=<spec>                 Pin a specific vis version (default: latest).
#   --help                           Show this help.
#
# Environment: VIS_NODE_MAJOR pins a specific Node major (default: latest LTS).
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

# Colors — suppressed when stdout isn't a TTY or NO_COLOR is set.
if [ -t 1 ] && [ -z "${NO_COLOR-}" ]; then
    bold=$'\033[1m'; dim=$'\033[2m'; reset=$'\033[0m'
    red=$'\033[31m'; green=$'\033[32m'; yellow=$'\033[33m'; blue=$'\033[34m'
else
    bold=""; dim=""; reset=""; red=""; green=""; yellow=""; blue=""
fi

info()    { printf '%s%sinfo:%s %s\n'    "$bold" "$blue"   "$reset" "$1" >&2; }
warn()    { printf '%s%swarn:%s %s\n'    "$bold" "$yellow" "$reset" "$1" >&2; }
err()     { printf '%s%serror:%s %s\n'   "$bold" "$red"    "$reset" "$1" >&2; }
success() { printf '%s%s✓%s %s\n'        "$bold" "$green"  "$reset" "$1" >&2; }

# ── Argument parsing ────────────────────────────────────────────────
#
# Each flag has a matching environment variable so `FOO=x curl ... | bash`
# works too — handy for CI where it's easier to export than to wrangle
# `bash -s --` argument forwarding.

MANAGER_CHOICE="${VIS_MANAGER:-proto}"
RUN_TOOLCHAIN_INSTALL="${VIS_RUN_TOOLCHAIN_INSTALL:-1}"
ASSUME_YES="${VIS_YES:-0}"
VIS_VERSION="${VIS_VERSION:-latest}"
# Empty = resolve the latest LTS at install time. VIS_NODE_MAJOR pins a
# specific major instead. FALLBACK is used only when LTS resolution
# can't reach nodejs.org.
NODE_MAJOR="${VIS_NODE_MAJOR:-}"
FALLBACK_NODE_MAJOR=24
# 1 when the user explicitly asked for a version manager (env or --manager=);
# otherwise the default path installs Node directly.
MANAGER_EXPLICIT=0
[ -n "${VIS_MANAGER:-}" ] && MANAGER_EXPLICIT=1

print_help() {
    cat <<'USAGE' >&2
vis install script — bootstrap Node + vis from scratch

Usage:
  curl -fsSL <url>/install.sh | bash                # interactive, installs Node LTS + vis
  curl -fsSL <url>/install.sh | bash -s -- <flags>

Flags:
  --manager=<name>          Use a version manager instead of a direct Node LTS
                            install. One of: proto, fnm, mise, volta.
  --no-toolchain-install    Skip `vis toolchain install` after install.
  --yes, -y                 Non-interactive; assume "yes" (installs Node LTS).
  --version=<spec>          Pin a specific vis version (default: latest).
  --help, -h                Show this help.

Environment:
  VIS_NODE_MAJOR            Pin a specific Node major (default: latest LTS).

Supports Linux and macOS. Windows users: run `npm install -g @visulima/vis`
from a shell where Node is already installed.
USAGE
    exit 0
}

while [ $# -gt 0 ]; do
    case "$1" in
        --manager=*)              MANAGER_CHOICE="${1#*=}"; MANAGER_EXPLICIT=1 ;;
        --no-toolchain-install)   RUN_TOOLCHAIN_INSTALL=0 ;;
        --yes|-y)                 ASSUME_YES=1 ;;
        --version=*)              VIS_VERSION="${1#*=}" ;;
        --help|-h)                print_help ;;
        *)                        err "Unknown flag: $1"; exit 2 ;;
    esac
    shift
done

# ── Input validation ────────────────────────────────────────────────
#
# MANAGER_CHOICE, NODE_MAJOR and VIS_VERSION are user-controlled (flags
# or env). They get interpolated into download URLs, an npm package
# spec, and rc-file writes, so reject anything outside a known-safe
# shape up front and fail closed rather than carrying a tainted value
# deeper into the script.

case "$MANAGER_CHOICE" in
    proto|fnm|mise|volta) ;;
    *)
        err "Invalid version manager: '$MANAGER_CHOICE'. Expected one of: proto, fnm, mise, volta."
        exit 2 ;;
esac

if [ -n "$NODE_MAJOR" ]; then
    case "$NODE_MAJOR" in
        ''|*[!0-9]*)
            err "Invalid VIS_NODE_MAJOR: '$NODE_MAJOR'. Expected a positive integer (e.g. 22)."
            exit 2 ;;
    esac
    # Strip leading zeros and reject 0.
    NODE_MAJOR=$((10#$NODE_MAJOR))
    if [ "$NODE_MAJOR" -lt 1 ]; then
        err "Invalid VIS_NODE_MAJOR: must be >= 1."
        exit 2
    fi
fi

# Allow letters, digits, '.', '-', '_' and '@' only: covers semver
# (1.2.3, 1.2.3-rc.1, ^1.2.3 is intentionally NOT allowed since the
# spec is passed to `npm install -g @visulima/vis@<spec>`) and dist
# tags (latest, next, beta). Rejects shell metacharacters, slashes and
# whitespace that could smuggle in a different package or command.
case "$VIS_VERSION" in
    ''|*[!A-Za-z0-9._@-]*)
        err "Invalid --version/VIS_VERSION: '$VIS_VERSION'. Expected a semver or dist-tag (e.g. 1.2.3, 1.2.3-rc.1, latest)."
        exit 2 ;;
esac

# ── Prerequisite checks ─────────────────────────────────────────────

for cmd in curl bash; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        err "\`$cmd\` is required but not found on PATH."
        exit 1
    fi
done

OS="$(uname -s)"
case "$OS" in
    Linux*|Darwin*) ;;
    *)
        err "Unsupported OS: $OS. On Windows, run \`npm install -g @visulima/vis\` from a shell with Node already installed."
        exit 1 ;;
esac

# ── Helpers ─────────────────────────────────────────────────────────

confirm() {
    # Skip prompt in non-interactive mode.
    if [ "$ASSUME_YES" = "1" ] || [ ! -t 0 ]; then
        return 0
    fi

    printf '%s [y/N] ' "$1" >&2
    read -r answer
    case "$answer" in
        y|Y|yes|YES) return 0 ;;
        *)           return 1 ;;
    esac
}

has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Re-read PATH additions the current shell session doesn't know about yet
# (proto/fnm/volta install into ~/.local/share/<tool>/bin or ~/.volta).
add_to_path() {
    case ":$PATH:" in
        *":$1:"*) ;;
        *) export PATH="$1:$PATH" ;;
    esac
}

# ── Manager installation ────────────────────────────────────────────

install_proto() {
    info "Installing proto via https://moonrepo.dev/install/proto.sh..."
    curl -fsSL https://moonrepo.dev/install/proto.sh | bash -s -- --yes
    add_to_path "$HOME/.proto/bin"
    add_to_path "$HOME/.proto/shims"
}

install_fnm() {
    info "Installing fnm via https://fnm.vercel.app/install..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
    add_to_path "$HOME/.local/share/fnm"
    eval "$("$HOME/.local/share/fnm/fnm" env)" || true
}

install_mise() {
    info "Installing mise via https://mise.run..."
    curl -fsSL https://mise.run | sh
    add_to_path "$HOME/.local/bin"
    eval "$("$HOME/.local/bin/mise" activate bash)" || true
}

install_volta() {
    info "Installing volta via https://get.volta.sh..."
    curl -fsSL https://get.volta.sh | bash -s -- --skip-setup
    add_to_path "$HOME/.volta/bin"
}

install_manager() {
    local manager="$1"

    # Temporarily disable -e so a vendor-script failure lets us surface
    # a scoped, vis-authored error instead of bailing with the vendor's
    # raw output and no context.
    set +e
    case "$manager" in
        proto) install_proto ;;
        fnm)   install_fnm ;;
        mise)  install_mise ;;
        volta) install_volta ;;
        *)
            err "Unknown manager: $manager. Supported: proto, fnm, mise, volta."
            exit 1 ;;
    esac
    local status=$?
    set -e

    if [ "$status" -ne 0 ]; then
        err "Failed to install ${manager} (vendor installer exited ${status})."
        err "Check your network and re-run the script, or install ${manager} manually and retry."
        exit "$status"
    fi
}

install_node_via_manager() {
    local manager="$1"
    local status=0

    # Capture the install command's exit code BEFORE running shell-env
    # activation. `eval "$(<manager> env) || true` always returns 0,
    # which would otherwise mask a real install failure on fnm/mise.
    set +e
    case "$manager" in
        proto)
            info "Installing Node LTS via proto..."
            # `proto install <tool> lts` resolves the LTS alias server-side.
            # npm ships with node, so no separate install step is needed.
            proto install node lts
            status=$?
            ;;
        fnm)
            info "Installing Node LTS via fnm..."
            fnm install --lts && fnm default lts-latest
            status=$?

            if [ "$status" -eq 0 ]; then
                eval "$(fnm env)" || true
            fi
            ;;
        mise)
            info "Installing Node LTS via mise..."
            mise use --global node@lts
            status=$?

            if [ "$status" -eq 0 ]; then
                eval "$(mise activate bash)" || true
            fi
            ;;
        volta)
            info "Installing Node LTS via volta..."
            volta install node@lts
            status=$?
            ;;
    esac
    set -e

    if [ "$status" -ne 0 ]; then
        err "Failed to install Node LTS via ${manager} (exit ${status})."
        err "Most common cause is a network / proxy issue. Try again, or run \`${manager} install node\` manually."
        exit "$status"
    fi
}

# ── Direct Node install (default path) ──────────────────────────────

# Map `uname -m` to Node's dist arch slug ("" = no prebuilt).
node_arch() {
    case "$(uname -m)" in
        x86_64|amd64)  echo "x64" ;;
        arm64|aarch64) echo "arm64" ;;
        armv7l)        echo "armv7l" ;;
        ppc64le)       echo "ppc64le" ;;
        s390x)         echo "s390x" ;;
        *)             echo "" ;;
    esac
}

node_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "darwin" ;;
        *)       echo "" ;;
    esac
}

# Newest LTS major from nodejs.org's release index ("" on failure).
# index.json is sorted newest-first; the first entry whose "lts" is a
# codename string (not the boolean false) is the latest LTS line.
resolve_lts_major() {
    curl -fsSL https://nodejs.org/dist/index.json 2>/dev/null \
        | tr '}' '\n' \
        | grep -m1 '"lts":"' \
        | sed -n 's/.*"version":"v\([0-9][0-9]*\)\..*/\1/p'
}

# Ensure NODE_MAJOR is set: an explicit pin wins, otherwise resolve the
# latest LTS, otherwise the static fallback. Idempotent.
ensure_node_major() {
    [ -n "$NODE_MAJOR" ] && return 0

    info "Resolving the latest Node LTS from nodejs.org..."
    NODE_MAJOR="$(resolve_lts_major || true)"

    if [ -z "$NODE_MAJOR" ]; then
        NODE_MAJOR="$FALLBACK_NODE_MAJOR"
        warn "Could not resolve the latest LTS — falling back to Node ${NODE_MAJOR}."
    fi
}

# Major version of the `node` currently on PATH ("" when none).
current_node_major() {
    has_cmd node || { echo ""; return; }
    node -v 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\).*/\1/p'
}

# True when the `node` on PATH satisfies vis's engines range,
# ^22.14.0 || >=24.10.0 (kept in sync with package.json). When it does
# we skip the runtime install entirely.
node_supported() {
    has_cmd node || return 1

    local v maj min pat
    v="$(node -v 2>/dev/null | sed 's/^v//')" || return 1
    maj="${v%%.*}"
    min="${v#*.}"; min="${min%%.*}"
    pat="${v##*.}"

    case "${maj}.${min}.${pat}" in
        *[!0-9.]*) return 1 ;;
    esac

    # ^22.14.0 → exactly major 22 and >= 22.14.0
    if [ "$maj" -eq 22 ]; then
        [ "$min" -gt 14 ] && return 0
        [ "$min" -eq 14 ] && return 0
        return 1
    fi

    # >=24.10.0 → 24.10.0+, or any newer major (25+)
    [ "$maj" -gt 24 ] && return 0

    if [ "$maj" -eq 24 ]; then
        [ "$min" -ge 10 ] && return 0
    fi

    return 1
}

# Append an idempotent PATH export to the user's shell profiles so a
# freshly-installed Node / npm-global bin survives new shells. A marker
# comment keeps re-runs from stacking duplicate lines.
persist_path() {
    local dir="$1"
    local marker="# added by vis install (node)"

    for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
        [ -f "$rc" ] || continue
        grep -qF "$marker" "$rc" 2>/dev/null && continue
        printf '\n%s\nexport PATH="%s:$PATH"\n' "$marker" "$dir" >> "$rc"
    done

    add_to_path "$dir"
}

# Try the OS package manager. Returns 0 only if it can plausibly provide
# Node >= $NODE_MAJOR; the caller still re-checks the resolved version.
install_node_via_os_pkgmgr() {
    local os
    os="$(node_os)"

    if [ "$os" = "darwin" ] && has_cmd brew; then
        info "Installing node@${NODE_MAJOR} via Homebrew..."

        if brew install "node@${NODE_MAJOR}"; then
            persist_path "$(brew --prefix)/opt/node@${NODE_MAJOR}/bin"
            return 0
        fi

        return 1
    fi

    if [ "$os" = "linux" ]; then
        # NodeSource needs root. Only attempt with passwordless sudo or
        # as root so a piped `curl | bash` never blocks on a hidden
        # password prompt.
        local SUDO=""

        if [ "$(id -u)" = "0" ]; then
            SUDO=""
        elif sudo -n true 2>/dev/null; then
            SUDO="sudo"
        else
            return 1
        fi

        if has_cmd apt-get; then
            info "Installing Node ${NODE_MAJOR} via NodeSource (apt)..."

            if [ -n "$SUDO" ]; then
                curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo bash -
            else
                curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
            fi && $SUDO apt-get install -y nodejs && return 0

            return 1
        fi

        if has_cmd dnf || has_cmd yum; then
            local RPM_MGR
            RPM_MGR="$(has_cmd dnf && echo dnf || echo yum)"

            info "Installing Node ${NODE_MAJOR} via NodeSource (${RPM_MGR})..."

            if [ -n "$SUDO" ]; then
                curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | sudo bash -
            else
                curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
            fi && $SUDO "$RPM_MGR" install -y nodejs && return 0

            return 1
        fi
    fi

    return 1
}

# Fallback: official Node ${NODE_MAJOR} tarball into a vis-owned prefix,
# sha256-verified. No sudo, no version manager.
install_node_via_tarball() {
    local os arch prefix
    os="$(node_os)"
    arch="$(node_arch)"
    prefix="$HOME/.vis/node"

    if [ -z "$os" ] || [ -z "$arch" ]; then
        err "No prebuilt Node ${NODE_MAJOR} for $(uname -s)/$(uname -m)."
        return 1
    fi

    info "Resolving the latest Node ${NODE_MAJOR}.x from nodejs.org..."

    local shasums ver
    if ! shasums="$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt")"; then
        err "Could not reach nodejs.org to resolve Node ${NODE_MAJOR}."
        return 1
    fi

    ver="$(printf '%s\n' "$shasums" | sed -n 's/.*node-v\([0-9.]*\)-.*/\1/p' | head -n1)"

    if [ -z "$ver" ]; then
        err "Could not parse the Node version from SHASUMS256.txt."
        return 1
    fi

    local file="node-v${ver}-${os}-${arch}.tar.gz"
    local url="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/${file}"
    local want
    want="$(printf '%s\n' "$shasums" | awk -v f="$file" '$2 == f { print $1 }')"

    if [ -z "$want" ]; then
        err "No checksum listed for ${file} (unsupported platform?)."
        return 1
    fi

    local tmp
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' RETURN

    info "Downloading ${file}..."

    if ! curl -fsSL "$url" -o "$tmp/$file"; then
        err "Download failed: $url"
        return 1
    fi

    local got
    if has_cmd sha256sum; then
        got="$(sha256sum "$tmp/$file" | awk '{ print $1 }')"
    elif has_cmd shasum; then
        got="$(shasum -a 256 "$tmp/$file" | awk '{ print $1 }')"
    elif has_cmd openssl; then
        got="$(openssl dgst -sha256 "$tmp/$file" | awk '{ print $NF }')"
    else
        # Fail closed: a tarball we can't verify is a tarball we don't
        # install. Never trust the download by aliasing got=want.
        err "No sha256 tool found (sha256sum, shasum or openssl). Cannot verify the Node download — aborting."
        return 1
    fi

    if [ "$got" != "$want" ]; then
        err "Checksum mismatch for ${file} (expected ${want}, got ${got})."
        return 1
    fi

    info "Installing Node ${ver} into ${prefix}..."
    rm -rf "$prefix"
    mkdir -p "$prefix"

    # --no-same-owner / --no-same-permissions: never restore archived
    # uid/gid/mode (matters if this path runs as root); files end up
    # owned by the invoking user with a sane umask.
    if ! tar -xzf "$tmp/$file" -C "$prefix" --strip-components=1 \
        --no-same-owner --no-same-permissions; then
        err "Extraction failed."
        return 1
    fi

    persist_path "$prefix/bin"

    return 0
}

# OS package manager first, nodejs.org tarball as fallback.
install_node_direct() {
    if install_node_via_os_pkgmgr; then
        local maj
        maj="$(current_node_major)"

        if [ -n "$maj" ] && [ "$maj" -ge "$NODE_MAJOR" ] 2>/dev/null; then
            success "Node $(node -v) installed via the OS package manager."

            return 0
        fi

        warn "OS package manager did not provide Node ${NODE_MAJOR} — falling back to nodejs.org."
    else
        info "OS package manager unavailable or unsuitable — using the nodejs.org tarball."
    fi

    if install_node_via_tarball; then
        success "Node $(node -v 2>/dev/null || echo "v${NODE_MAJOR}.x") installed under ~/.vis/node."

        return 0
    fi

    return 1
}

# Node already satisfies vis's range, but a version manager is still
# handy for per-project pinning. Offer it — opt-in, and never fatal
# (the user's working Node must keep working).
offer_version_manager() {
    local want=0

    if [ "$MANAGER_EXPLICIT" = "1" ]; then
        want=1
    elif [ "$ASSUME_YES" != "1" ] && [ -t 0 ]; then
        if confirm "Node is set. Also set up a version manager (proto / fnm / mise / volta) for per-project tool versions?"; then
            want=1
        fi
    fi

    [ "$want" = "1" ] || return 0

    if [ "$MANAGER_EXPLICIT" != "1" ] && [ "$ASSUME_YES" != "1" ] && [ -t 0 ]; then
        echo "  1. proto (recommended — multi-language, reads .prototools / .nvmrc / engines.node)" >&2
        echo "  2. fnm   (Node only, fastest shell activation)" >&2
        echo "  3. mise  (Rust, asdf-compatible, 700+ plugins)" >&2
        echo "  4. volta (Node + JS package managers, package.json-driven)" >&2
        printf '\nWhich version manager? [1-4, default: 1] ' >&2
        read -r choice
        case "$choice" in
            2) MANAGER_CHOICE="fnm" ;;
            3) MANAGER_CHOICE="mise" ;;
            4) MANAGER_CHOICE="volta" ;;
            *) MANAGER_CHOICE="proto" ;;
        esac
    fi

    info "Setting up ${MANAGER_CHOICE} (your existing Node stays available)..."

    # install_manager / install_node_via_manager call `exit` on failure
    # — right for the cold-start path, but here Node already works, so
    # isolate them in a subshell and downgrade a failure to a warning.
    if ( install_manager "$MANAGER_CHOICE" && install_node_via_manager "$MANAGER_CHOICE" ); then
        success "${MANAGER_CHOICE} is set up. Open a new shell to start using it."
    else
        warn "Could not set up ${MANAGER_CHOICE}. Continuing with your existing Node."
    fi
}

# ── Main flow ───────────────────────────────────────────────────────

printf '\n%svis%s — bootstrap installer\n\n' "$bold" "$reset" >&2

if node_supported; then
    NODE_VERSION="$(node --version 2>/dev/null | sed 's/^v//' || true)"
    success "Node ${NODE_VERSION} detected (satisfies vis's supported range) — skipping runtime install."
    offer_version_manager
else
    if has_cmd node; then
        warn "Node $(node -v 2>/dev/null) is on PATH but doesn't satisfy vis's supported range."
    else
        warn "No Node detected on PATH."
    fi
    info "vis requires Node ^22.14.0 || >=24.10.0."

    # Default: install the latest Node LTS directly. A version manager
    # is opt-in — only when explicitly requested (--manager= /
    # VIS_MANAGER) or chosen at the prompt below. We no longer force it.
    USE_MANAGER=0

    if [ "$MANAGER_EXPLICIT" = "1" ]; then
        USE_MANAGER=1
    elif [ "$ASSUME_YES" != "1" ] && [ -t 0 ]; then
        echo "  1. Install the latest Node LTS directly (recommended — no extra tooling)" >&2
        echo "  2. Set up a version manager instead (proto / fnm / mise / volta)" >&2
        printf '\nHow would you like to get Node? [1-2, default: 1] ' >&2
        read -r node_choice
        [ "$node_choice" = "2" ] && USE_MANAGER=1
    fi

    if [ "$USE_MANAGER" = "1" ]; then
        if [ "$MANAGER_EXPLICIT" != "1" ] && [ "$ASSUME_YES" != "1" ] && [ -t 0 ]; then
            echo "  1. proto (recommended — multi-language, reads .prototools / .nvmrc / engines.node)" >&2
            echo "  2. fnm   (Node only, fastest shell activation)" >&2
            echo "  3. mise  (Rust, asdf-compatible, 700+ plugins)" >&2
            echo "  4. volta (Node + JS package managers, package.json-driven)" >&2
            printf '\nWhich version manager? [1-4, default: 1] ' >&2
            read -r choice
            case "$choice" in
                2) MANAGER_CHOICE="fnm" ;;
                3) MANAGER_CHOICE="mise" ;;
                4) MANAGER_CHOICE="volta" ;;
                *) MANAGER_CHOICE="proto" ;;
            esac
        fi

        if ! confirm "Install ${MANAGER_CHOICE} and use it to install Node LTS?"; then
            err "Aborted. Re-run and pick 'Install Node directly', or install Node manually."
            exit 1
        fi

        install_manager "$MANAGER_CHOICE"
        install_node_via_manager "$MANAGER_CHOICE"

        if ! has_cmd node; then
            err "Node is still not on PATH after installing $MANAGER_CHOICE."
            err "Open a new shell session (or \`source ~/.bashrc\` / \`~/.zshrc\`) and re-run this script."
            exit 1
        fi

        success "Node $(node --version) installed via $MANAGER_CHOICE."
    else
        ensure_node_major

        if ! confirm "Install the latest Node LTS (v${NODE_MAJOR}.x) now?"; then
            err "Aborted. Re-run and choose a version manager, or install Node manually."
            exit 1
        fi

        if ! install_node_direct; then
            err "Could not install Node ${NODE_MAJOR} automatically."
            err "Install Node manually (https://nodejs.org) or re-run and choose a version manager."
            exit 1
        fi

        if ! has_cmd node; then
            err "Node installed but not on PATH in this session."
            err "Open a new shell (or \`source ~/.bashrc\`) and re-run this script."
            exit 1
        fi
    fi
fi

# ── Install vis ──────────────────────────────────────────────────────

if has_cmd pnpm; then
    PM="pnpm"
elif has_cmd npm; then
    PM="npm"
else
    err "Neither pnpm nor npm is on PATH after Node install. Aborting."
    exit 1
fi

PKG_SPEC="@visulima/vis"
if [ "$VIS_VERSION" != "latest" ]; then
    PKG_SPEC="@visulima/vis@${VIS_VERSION}"
fi

info "Installing $PKG_SPEC globally via $PM..."
case "$PM" in
    pnpm) pnpm add -g "$PKG_SPEC" ;;
    npm)  npm install -g "$PKG_SPEC" ;;
esac

if ! has_cmd vis; then
    if [ "$PM" = "pnpm" ]; then
        err "vis is installed but not on PATH. Check your global bin directory (run: \`pnpm bin -g\`)."
    else
        err "vis is installed but not on PATH. Check your global bin directory (run: \`npm config get prefix\`)."
    fi
    exit 1
fi

success "vis $(vis --version 2>/dev/null || echo '?') installed."

# ── Optional: toolchain install in current workspace ────────────────

if [ "$RUN_TOOLCHAIN_INSTALL" = "1" ]; then
    # Walk up from CWD looking for workspace pin files — stop at the git
    # root (or the filesystem root when we're not in a git checkout).
    WORKSPACE_MARKERS=".nvmrc .node-version .prototools .mise.toml .tool-versions vis.config.ts vis.config.js"
    FOUND_MARKER=""
    SEARCH_DIR="$PWD"

    while [ "$SEARCH_DIR" != "/" ] && [ -n "$SEARCH_DIR" ]; do
        for marker in $WORKSPACE_MARKERS; do
            if [ -f "$SEARCH_DIR/$marker" ]; then
                FOUND_MARKER="$SEARCH_DIR/$marker"
                break 2
            fi
        done

        # Stop at the git root so we don't wander out of the repo.
        if [ -d "$SEARCH_DIR/.git" ]; then
            break
        fi

        SEARCH_DIR="$(dirname "$SEARCH_DIR")"
    done

    if [ -n "$FOUND_MARKER" ]; then
        info "Found $FOUND_MARKER — running \`vis toolchain install\`..."

        if vis toolchain install; then
            success "Workspace toolchain matches all pins."
        else
            warn "\`vis toolchain install\` exited non-zero. Check the output above."
        fi
    else
        info "${dim}(skipping \`vis toolchain install\` — no workspace pin files found)${reset}"
    fi
fi

printf '\n%sNext steps:%s\n' "$bold" "$reset" >&2
printf '  %svis doctor%s       — full project health check\n' "$dim" "$reset" >&2
printf '  %svis toolchain status%s — report tool versions\n' "$dim" "$reset" >&2
printf '  %svis run build%s    — run a workspace target\n' "$dim" "$reset" >&2
echo "" >&2
