/**
 * CLI tips system - displays contextual hints after command execution.
 *
 * Features (per vite-plus RFC):
 * - Probabilistic frequency control with per-tip cooldowns
 * - Contextual matching based on command, args, and success state
 * - Rate-limited globally (max 1 tip per 5 minutes)
 * - Per-tip cooldown tracking (each tip has its own cooldown)
 * - Suppressed in CI/test environments
 * - Dimmed styling to avoid being intrusive
 */

import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import isInCi from "is-in-ci";

import { getVisStateDir } from "./vis-paths";

interface TipContext {
    args: string[];
    command: string;
    hasVisConfig?: boolean;
    success: boolean;
}

interface Tip {
    /** Per-tip cooldown in milliseconds. Default: GLOBAL_COOLDOWN_MS */
    cooldownMs?: number;
    /** Unique identifier for per-tip cooldown tracking */
    id: string;
    matches: (context: TipContext) => boolean;
    message: (context: TipContext) => string;
    /** Probability of showing when matched (0.0 - 1.0). Default: 1.0 */
    probability?: number;
}

const GLOBAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const STATE_FILE = join(getVisStateDir(), "tips.json");

interface TipState {
    /** Last time any tip was shown (global rate limit) */
    lastGlobal: number;
    /** Per-tip cooldown timestamps keyed by tip id */
    perTip: Record<string, number>;
}

const readState = (): TipState => {
    try {
        if (isAccessibleSync(STATE_FILE)) {
            return readJsonSync(STATE_FILE) as unknown as TipState;
        }
    } catch {
        // Corrupted state, reset
    }

    return { lastGlobal: 0, perTip: {} };
};

const writeState = (state: TipState): void => {
    try {
        ensureDirSync(getVisStateDir());
        writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch {
        // Non-critical, skip
    }
};

// ── Tip definitions ──────────────────────────────────────────────────

const tips: Tip[] = [
    {
        cooldownMs: 30 * 60 * 1000, // 30 minutes
        id: "short-aliases",
        matches: (context) => ["install", "link", "remove", "uninstall", "update"].includes(context.command),
        message: (context) => {
            const aliases: Record<string, string> = {
                install: "i",
                link: "ln",
                remove: "rm",
                uninstall: "rm",
                update: "up",
            };
            const alias = aliases[context.command];

            return alias ? `You can use 'vis ${alias}' as a shorthand for 'vis ${context.command}'` : "";
        },
        probability: 0.5,
    },
    {
        id: "use-exec",
        matches: (context) => context.command === "dlx" && context.success,
        message: () => "Use 'vis exec' to run locally installed binaries without downloading.",
    },
    {
        id: "security-check",
        matches: (context) => (context.command === "check" || context.command === "update") && context.success && !context.args.includes("--security"),
        message: () => "Add --security to check for known vulnerabilities via OSV.dev",
        probability: 0.3,
    },
    {
        cooldownMs: 60 * 60 * 1000, // 1 hour
        id: "ai-analysis",
        matches: (context) => (context.command === "check" || context.command === "update") && context.success && !context.args.includes("--ai"),
        message: () => "Add --ai to run AI analysis on outdated packages before updating.",
        probability: 0.2,
    },
    {
        cooldownMs: 24 * 60 * 60 * 1000, // 24 hours
        id: "socket-security",
        matches: (context) => (context.command === "install" || context.command === "update" || context.command === "check") && context.success,
        message: () => "Enable Socket.dev in vis.config.ts for security scores and supply chain alerts: security.socket.enabled = true",
        probability: 0.15,
    },
    {
        id: "dedupe-after-install",
        matches: (context) => context.command === "install" && context.success,
        message: () => "Run 'vis dedupe' periodically to remove duplicate dependencies.",
        probability: 0.15,
    },
    {
        cooldownMs: 12 * 60 * 60 * 1000,
        id: "doctor-checkup",
        matches: (context) => (context.command === "install" || context.command === "add" || context.command === "update") && context.success,
        message: () => "Run 'vis doctor' for a full project health check — outdated, security, duplicates, and optimizations in one view.",
        probability: 0.25,
    },
    {
        cooldownMs: 7 * 24 * 60 * 60 * 1000,
        id: "init-config",
        matches: (context) => (context.command === "install" || context.command === "run") && context.success && !context.hasVisConfig,
        message: () => "Run 'vis init' to create a vis.config.ts with secure defaults — supply chain protection enabled automatically.",
        probability: 0.4,
    },
    {
        id: "why-command",
        matches: (context) => context.command === "outdated" && context.success,
        message: () => "Use 'vis why <package>' to understand why a dependency is installed.",
        probability: 0.3,
    },
    {
        id: "graph-command",
        matches: (context) => context.command === "run" && context.success,
        message: () => "Use 'vis graph' to visualize your project dependency graph.",
        probability: 0.1,
    },
    {
        id: "affected-command",
        matches: (context) => context.command === "run" && context.success && !context.args.includes("--projects"),
        message: () => "Use 'vis affected <target>' to run tasks only on changed projects.",
        probability: 0.2,
    },
    {
        id: "pm-cache",
        matches: (context) => context.command === "install" && context.success,
        message: () => "Use 'vis pm cache dir' to find your package manager's cache location.",
        probability: 0.1,
    },
    {
        id: "create-editor",
        matches: (context) => context.command === "create" && context.success,
        message: () => "Add --editor vscode to generate VS Code configuration during project creation.",
        probability: 0.5,
    },
    {
        id: "env-pin",
        matches: (context) => context.command === "env" && context.args.includes("install") && context.success,
        message: () => "Use 'vis env pin <version>' to pin the Node.js version for your project.",
        probability: 0.5,
    },
    {
        id: "upgrade-check",
        matches: (context) => context.command !== "self-update" && context.success,
        message: () => "Run 'vis self-update --check' to see if a newer version of vis is available.",
        probability: 0.05, // Very low probability - occasional reminder
    },
];

/**
 * Show a contextual tip if rate-limits allow and a tip matches.
 *
 * Flow:
 * 1. Check environment (skip in CI/test).
 * 2. Check global cooldown (max 1 tip per 5 minutes).
 * 3. Find matching tips, filter by per-tip cooldowns.
 * 4. Apply probability filter.
 * 5. Show the first surviving tip, update state.
 */
const showTip = (context: TipContext): void => {
    // Skip in test/CI environments
    if (process.env.VIS_CLI_TEST || isInCi) {
        return;
    }

    const now = Date.now();
    const state = readState();

    // Global rate limit
    if (now - state.lastGlobal < GLOBAL_COOLDOWN_MS) {
        return;
    }

    // Find matching tips, respecting per-tip cooldowns
    const candidates = tips.filter((tip) => {
        if (!tip.matches(context)) {
            return false;
        }

        const lastShown = state.perTip[tip.id] ?? 0;
        const cooldown = tip.cooldownMs ?? GLOBAL_COOLDOWN_MS;

        return now - lastShown >= cooldown;
    });

    if (candidates.length === 0) {
        return;
    }

    // Apply probabilistic filtering
    const selected = candidates.find((tip) => {
        const probability = tip.probability ?? 1;

        // eslint-disable-next-line sonarjs/pseudo-random -- tip-of-the-day display: not security-sensitive
        return Math.random() < probability;
    });

    if (!selected) {
        return;
    }

    const message = selected.message(context);

    if (!message) {
        return;
    }

    // Dimmed styling
    process.stderr.write(`\n\u001B[2mtip: ${message}\u001B[0m\n`);

    // Update state
    state.lastGlobal = now;
    state.perTip[selected.id] = now;
    writeState(state);
};

export type { Tip, TipContext };
export { showTip, tips };
