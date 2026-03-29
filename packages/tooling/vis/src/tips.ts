/**
 * CLI tips system - displays contextual hints after command execution.
 * Tips are rate-limited (once per 5 minutes) and shown in dimmed styling.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface TipContext {
    args: string[];
    command: string;
    success: boolean;
}

interface Tip {
    matches: (context: TipContext) => boolean;
    message: (context: TipContext) => string;
}

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const STATE_FILE = join(homedir(), ".vis", ".tip-state");

const getLastTipTime = (): number => {
    try {
        if (existsSync(STATE_FILE)) {
            return Number.parseInt(readFileSync(STATE_FILE, "utf8").trim(), 10) || 0;
        }
    } catch {
        // Ignore
    }

    return 0;
};

const setLastTipTime = (time: number): void => {
    try {
        const dir = join(homedir(), ".vis");

        if (existsSync(dir)) {
            writeFileSync(STATE_FILE, String(time));
        }
    } catch {
        // Ignore
    }
};

// ── Tip definitions ──────────────────────────────────────────────────

const shortAliasesTip: Tip = {
    matches: (ctx) => {
        const longCommands = ["install", "remove", "uninstall", "update", "link"];

        return longCommands.includes(ctx.command);
    },
    message: (ctx) => {
        const aliases: Record<string, string> = {
            install: "i",
            link: "ln",
            remove: "rm",
            uninstall: "rm",
            update: "up",
        };

        const alias = aliases[ctx.command];

        return alias ? `tip: You can use 'vis ${alias}' as a shorthand for 'vis ${ctx.command}'` : "";
    },
};

const useExecTip: Tip = {
    matches: (ctx) => ctx.command === "dlx" && ctx.success,
    message: () => "tip: Use 'vis exec' to run locally installed binaries without downloading.",
};

const checkSecurityTip: Tip = {
    matches: (ctx) => (ctx.command === "check" || ctx.command === "update") && !ctx.args.includes("--security"),
    message: () => "tip: Add --security to check for known vulnerabilities via OSV.dev",
};

const aiAnalysisTip: Tip = {
    matches: (ctx) => (ctx.command === "check" || ctx.command === "update") && !ctx.args.includes("--ai"),
    message: () => "tip: Add --ai to run AI analysis on outdated packages before updating.",
};

const tips: Tip[] = [shortAliasesTip, useExecTip, checkSecurityTip, aiAnalysisTip];

/**
 * Show a contextual tip if rate-limit allows and a tip matches.
 */
const showTip = (context: TipContext): void => {
    // Skip in test/CI environments
    if (process.env.VIS_CLI_TEST || process.env.CI) {
        return;
    }

    const now = Date.now();

    if (now - getLastTipTime() < RATE_LIMIT_MS) {
        return;
    }

    for (const tip of tips) {
        if (tip.matches(context)) {
            const message = tip.message(context);

            if (message) {
                // Dimmed styling
                process.stderr.write(`\n\x1B[2m${message}\x1B[0m\n`);
                setLastTipTime(now);

                break;
            }
        }
    }
};

export type { Tip, TipContext };
export { showTip };
