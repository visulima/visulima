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
#   1. Detects an existing Node on PATH. If none is found, offers to
#      install proto (multi-language version manager) and use it to
#      install a recent Node LTS.
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
#   --manager=proto|fnm|mise|volta   Preferred manager when no Node exists.
#                                    Default: proto.
#   --no-toolchain-install           Skip `vis toolchain install` after install.
#   --yes                            Non-interactive; assume "yes" to prompts.
#   --version=<spec>                 Pin a specific vis version (default: latest).
#   --help                           Show this help.
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

print_help() {
    cat <<'USAGE' >&2
vis install script — bootstrap Node + vis from scratch

Usage:
  curl -fsSL <url>/install.sh | bash                # interactive, installs proto + Node LTS + vis
  curl -fsSL <url>/install.sh | bash -s -- <flags>

Flags:
  --manager=<name>          Preferred manager when no Node exists. One of:
                            proto (default), fnm, mise, volta.
  --no-toolchain-install    Skip `vis toolchain install` after install.
  --yes, -y                 Non-interactive; assume "yes" to prompts.
  --version=<spec>          Pin a specific vis version (default: latest).
  --help, -h                Show this help.

Supports Linux and macOS. Windows users: run `npm install -g @visulima/vis`
from a shell where Node is already installed.
USAGE
    exit 0
}

while [ $# -gt 0 ]; do
    case "$1" in
        --manager=*)              MANAGER_CHOICE="${1#*=}" ;;
        --no-toolchain-install)   RUN_TOOLCHAIN_INSTALL=0 ;;
        --yes|-y)                 ASSUME_YES=1 ;;
        --version=*)              VIS_VERSION="${1#*=}" ;;
        --help|-h)                print_help ;;
        *)                        err "Unknown flag: $1"; exit 2 ;;
    esac
    shift
done

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

# ── Main flow ───────────────────────────────────────────────────────

printf '\n%svis%s — bootstrap installer\n\n' "$bold" "$reset" >&2

if has_cmd node; then
    NODE_VERSION="$(node --version 2>/dev/null | sed 's/^v//' || true)"
    success "Node ${NODE_VERSION} detected on PATH — skipping runtime install."
else
    warn "No Node detected on PATH."
    info "vis needs Node ≥ 18 to run. Bootstrap options:"
    echo "  1. proto (recommended — multi-language, reads .prototools / .nvmrc / engines.node)" >&2
    echo "  2. fnm   (Node only, fastest shell activation)" >&2
    echo "  3. mise  (Rust, asdf-compatible, 700+ plugins)" >&2
    echo "  4. volta (Node + JS package managers, package.json-driven)" >&2

    if [ "$ASSUME_YES" != "1" ] && [ -t 0 ]; then
        printf '\nWhich would you like to install? [1-4, default: 1] ' >&2
        read -r choice
        case "$choice" in
            2) MANAGER_CHOICE="fnm" ;;
            3) MANAGER_CHOICE="mise" ;;
            4) MANAGER_CHOICE="volta" ;;
            *) MANAGER_CHOICE="proto" ;;
        esac
    fi

    if ! confirm "Install ${MANAGER_CHOICE} and use it to install Node LTS?"; then
        err "Aborted. Install Node manually or choose a different manager via --manager=<name>."
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
