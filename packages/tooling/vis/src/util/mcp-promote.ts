/**
 * vis-mcp promotion nudge — encourages users to wire `@visulima/vis-mcp`
 * into their AI CLI when one is installed but unconfigured.
 *
 * Shown at most once every 14 days, after a successful command. Suppressed
 * in CI / test / non-TTY environments, when explicitly disabled via config
 * (`mcpPromote.enabled = false`) or env (`VIS_NO_MCP_PROMOTE=1`), and
 * during commands the user is likely already mid-configuration on
 * (`ai`, `--help`, `--version`).
 *
 * Detection is per-AI-CLI (Claude Code, Cursor, Windsurf, Continue, Zed,
 * Cline): we probe the standard config path, parse it, and look for a
 * `vis` / `@visulima/vis-mcp` server entry. The first detected-but-
 * unconfigured CLI is what we nudge for; rotation across nudges happens
 * naturally because configuring it removes it from the candidate set.
 *
 * No config file is ever written by this module. The tip is a copy-paste
 * command — staying out of the trust chain is intentional.
 */

import { homedir, platform } from "node:os";

import { bold, cyan, dim } from "@visulima/colorize";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import isInCi from "is-in-ci";

import type { VisConfig } from "../config/types";
import { getVisStateDir } from "./vis-paths";

const MCP_PROMOTE_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const STATE_FILE = join(getVisStateDir(), "mcp-promote.json");
const VIS_MCP_PACKAGE = "@visulima/vis-mcp";

/** Commands where a nudge would be noise — skip them. */
const EXCLUDED_COMMANDS = new Set<string>(["--help", "--version", "-h", "-V", "ai", "help", "implode", "mcp"]);

interface McpPromoteContext {
    command?: string;
    success: boolean;
    visConfig?: VisConfig;
}

interface McpPromoteState {
    lastShown: number;
}

interface AiCliCandidate {
    /** Human-readable name shown in the tip. */
    displayName: string;
    /** Stable id (e.g. "claude-code"). */
    id: string;
    /** Copy-paste command the user runs to wire vis-mcp into this CLI. */
    installCommand: string;
    /** True iff vis-mcp is already wired in. Only meaningful when installed. */
    isConfigured: boolean;
    /** True iff the CLI is installed locally. */
    isInstalled: boolean;
}

const readState = (): McpPromoteState => {
    try {
        if (isAccessibleSync(STATE_FILE)) {
            return readJsonSync(STATE_FILE) as unknown as McpPromoteState;
        }
    } catch {
        // Corrupted state, reset
    }

    return { lastShown: 0 };
};

const writeState = (state: McpPromoteState): void => {
    try {
        ensureDirSync(getVisStateDir());
        writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch {
        // Non-critical, skip
    }
};

/**
 * Read a JSON file at `path` returning `undefined` on any error. Used by
 * detectors — a malformed AI CLI config should never crash vis.
 */
const readJsonSafe = (path: string): unknown => {
    try {
        if (!isAccessibleSync(path)) {
            return undefined;
        }

        return readJsonSync(path);
    } catch {
        return undefined;
    }
};

/**
 * Decide whether an `mcpServers` map (Claude Code / Cursor / Windsurf /
 * Continue v1) contains a vis-mcp entry. Matches by command-string
 * substring so renames (`vis`, `visulima-vis`, `vis-mcp`, …) all count.
 */
const mapHasVisMcp = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    for (const entry of Object.values(value as Record<string, unknown>)) {
        if (typeof entry !== "object" || entry === null) {
            continue;
        }

        const record = entry as { args?: unknown; command?: unknown };
        const args = Array.isArray(record.args) ? record.args.join(" ") : "";
        const haystack = `${typeof record.command === "string" ? record.command : ""} ${args}`;

        if (haystack.includes(VIS_MCP_PACKAGE) || haystack.includes("vis-mcp")) {
            return true;
        }
    }

    return false;
};

/**
 * Decide whether an `mcpServers` array (Continue v2 shape) contains a
 * vis-mcp entry. Same matching semantics as `mapHasVisMcp`.
 */
const arrayHasVisMcp = (value: unknown): boolean => {
    if (!Array.isArray(value)) {
        return false;
    }

    for (const entry of value) {
        if (typeof entry !== "object" || entry === null) {
            continue;
        }

        const record = entry as { args?: unknown; command?: unknown; name?: unknown };
        const args = Array.isArray(record.args) ? record.args.join(" ") : "";
        const haystack = `${typeof record.command === "string" ? record.command : ""} ${args} ${typeof record.name === "string" ? record.name : ""}`;

        if (haystack.includes(VIS_MCP_PACKAGE) || haystack.includes("vis-mcp")) {
            return true;
        }
    }

    return false;
};

/**
 * Detection lane for Claude Code. The CLI persists MCP servers under
 * `mcpServers` in `~/.claude.json` (the unified config that also holds
 * project state). The bare presence of `~/.claude/` is enough to count
 * the CLI as installed, but the config file itself is what we read for
 * the wired-in check.
 */
const detectClaudeCode = (home: string): AiCliCandidate => {
    const dir = join(home, ".claude");
    const configPath = join(home, ".claude.json");
    const isInstalled = isAccessibleSync(dir) || isAccessibleSync(configPath);

    let isConfigured = false;

    if (isInstalled) {
        const config = readJsonSafe(configPath) as { mcpServers?: unknown } | undefined;

        isConfigured = mapHasVisMcp(config?.mcpServers);
    }

    return {
        displayName: "Claude Code",
        id: "claude-code",
        installCommand: `claude mcp add vis -- npx -y ${VIS_MCP_PACKAGE}@latest`,
        isConfigured,
        isInstalled,
    };
};

const detectCursor = (home: string): AiCliCandidate => {
    const configPath = join(home, ".cursor", "mcp.json");
    const isInstalled = isAccessibleSync(join(home, ".cursor"));

    let isConfigured = false;

    if (isInstalled) {
        const config = readJsonSafe(configPath) as { mcpServers?: unknown } | undefined;

        isConfigured = mapHasVisMcp(config?.mcpServers);
    }

    return {
        displayName: "Cursor",
        id: "cursor",
        installCommand: `Add to ~/.cursor/mcp.json: "vis": { "command": "npx", "args": ["-y", "${VIS_MCP_PACKAGE}@latest"] }`,
        isConfigured,
        isInstalled,
    };
};

const detectWindsurf = (home: string): AiCliCandidate => {
    const dir = join(home, ".codeium", "windsurf");
    const configPath = join(dir, "mcp_config.json");
    const isInstalled = isAccessibleSync(dir);

    let isConfigured = false;

    if (isInstalled) {
        const config = readJsonSafe(configPath) as { mcpServers?: unknown } | undefined;

        isConfigured = mapHasVisMcp(config?.mcpServers);
    }

    return {
        displayName: "Windsurf",
        id: "windsurf",
        installCommand: `Add to ~/.codeium/windsurf/mcp_config.json: "vis": { "command": "npx", "args": ["-y", "${VIS_MCP_PACKAGE}@latest"] }`,
        isConfigured,
        isInstalled,
    };
};

const detectContinue = (home: string): AiCliCandidate => {
    const dir = join(home, ".continue");
    const configPath = join(dir, "config.json");
    const isInstalled = isAccessibleSync(dir);

    let isConfigured = false;

    if (isInstalled) {
        const config = readJsonSafe(configPath) as { mcpServers?: unknown } | undefined;

        // Continue accepts both shapes across versions.
        isConfigured = mapHasVisMcp(config?.mcpServers) || arrayHasVisMcp(config?.mcpServers);
    }

    return {
        displayName: "Continue",
        id: "continue",
        installCommand: `Add to ~/.continue/config.json mcpServers: { "name": "vis", "command": "npx", "args": ["-y", "${VIS_MCP_PACKAGE}@latest"] }`,
        isConfigured,
        isInstalled,
    };
};

/**
 * Zed stores assistant config under `~/.config/zed/settings.json` on
 * Linux/Windows and `~/Library/Application Support/Zed/settings.json` on
 * macOS. The MCP key is `context_servers`. Best-effort — if Zed renames
 * the key the candidate just stays "unconfigured", which is acceptable.
 */
const detectZed = (home: string): AiCliCandidate => {
    const macPath = join(home, "Library", "Application Support", "Zed", "settings.json");
    const xdgPath = join(home, ".config", "zed", "settings.json");
    const configPath = platform() === "darwin" ? macPath : xdgPath;
    const isInstalled = isAccessibleSync(configPath);

    let isConfigured = false;

    if (isInstalled) {
        const config = readJsonSafe(configPath) as { context_servers?: unknown } | undefined;

        isConfigured = mapHasVisMcp(config?.context_servers);
    }

    return {
        displayName: "Zed",
        id: "zed",
        installCommand: `Add to Zed settings.json under context_servers: "vis": { "command": "npx", "args": ["-y", "${VIS_MCP_PACKAGE}@latest"] }`,
        isConfigured,
        isInstalled,
    };
};

/**
 * Cline lives inside the VS Code (or Cursor) extension state and stores
 * MCP servers in `cline_mcp_settings.json` under the extension's global
 * storage directory. Path varies across VS Code on Linux vs macOS; this
 * is best-effort and intentionally skips Windows-specific `%APPDATA%`
 * lookups for now.
 *
 * We deliberately require the Cline-specific settings file to exist
 * before flagging the CLI as installed — checking the bare
 * `~/.vscode/extensions` directory would false-positive for anyone with
 * VS Code installed, regardless of whether they use Cline.
 */
const detectCline = (home: string): AiCliCandidate => {
    const candidates = [
        join(home, ".config", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
        join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
    ];

    let configPath: string | undefined;

    for (const path of candidates) {
        if (isAccessibleSync(path)) {
            configPath = path;
            break;
        }
    }

    const isInstalled = configPath !== undefined;
    let isConfigured = false;

    if (configPath !== undefined) {
        const config = readJsonSafe(configPath) as { mcpServers?: unknown } | undefined;

        isConfigured = mapHasVisMcp(config?.mcpServers);
    }

    return {
        displayName: "Cline",
        id: "cline",
        installCommand: `In VS Code: open Cline > MCP Servers, add "vis" with command "npx" and args ["-y", "${VIS_MCP_PACKAGE}@latest"]`,
        isConfigured,
        isInstalled,
    };
};

/**
 * Run all detectors. Order is the priority order for picking which CLI
 * to nudge for when several are installed. Claude Code first because it
 * has the cleanest CLI install path.
 */
const detectAiClis = (): AiCliCandidate[] => {
    const home = homedir();

    return [detectClaudeCode(home), detectCursor(home), detectWindsurf(home), detectContinue(home), detectZed(home), detectCline(home)];
};

/**
 * Decide whether to show the nudge for this invocation. Mirrors the
 * upgrade-check / sponsor predicates so the CLI behaves predictably.
 */
const shouldRun = (context: McpPromoteContext): boolean => {
    if (!context.success) {
        return false;
    }

    if (process.env["VIS_CLI_TEST"] || isInCi) {
        return false;
    }

    if (process.env["VIS_NO_MCP_PROMOTE"] === "1") {
        return false;
    }

    if (context.visConfig?.mcpPromote?.enabled === false) {
        return false;
    }

    if (!process.stderr.isTTY) {
        return false;
    }

    if (context.command !== undefined && EXCLUDED_COMMANDS.has(context.command)) {
        return false;
    }

    const args = new Set(process.argv.slice(2));

    if (args.has("--silent") || args.has("-s") || args.has("--json")) {
        return false;
    }

    return true;
};

/**
 * Show the vis-mcp promotion notice if rate-limits, opt-outs, and AI-CLI
 * detection all line up. Safe to call after any command — a silent skip
 * is the default outcome.
 */
const showMcpPromote = (context: McpPromoteContext): void => {
    if (!shouldRun(context)) {
        return;
    }

    const now = Date.now();
    const state = readState();

    if (now - state.lastShown < MCP_PROMOTE_INTERVAL_MS) {
        return;
    }

    const candidates = detectAiClis();
    const target = candidates.find((c) => c.isInstalled && !c.isConfigured);

    if (target === undefined) {
        // Either no AI CLI installed, or every detected CLI already has
        // vis-mcp wired in. Either way, nothing to nudge about.
        return;
    }

    process.stderr.write(
        `\n${cyan("✨")} ${bold(`vis ships an MCP server for ${target.displayName}.`)}\n   ${target.installCommand}\n   ${dim(
            "Hide this with VIS_NO_MCP_PROMOTE=1 or mcpPromote: { enabled: false } in vis.config.ts",
        )}\n`,
    );

    writeState({ lastShown: now });
};

export type { AiCliCandidate, McpPromoteContext };
export {
    arrayHasVisMcp,
    detectAiClis,
    detectClaudeCode,
    detectCline,
    detectContinue,
    detectCursor,
    detectWindsurf,
    detectZed,
    EXCLUDED_COMMANDS,
    mapHasVisMcp,
    MCP_PROMOTE_INTERVAL_MS,
    showMcpPromote,
    VIS_MCP_PACKAGE,
};
