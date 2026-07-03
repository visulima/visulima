/**
 * Sponsor notice — encourages users to support visulima.
 *
 * Shown at most once every 14 days, after a successful command. Suppressed
 * in CI / test / non-TTY environments and when explicitly disabled via
 * config (`sponsor.enabled = false`) or env (`VIS_NO_SPONSOR=1`).
 */

import { bold, dim, magenta } from "@visulima/colorize";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import isInCi from "is-in-ci";

import type { VisConfig } from "../config/types";
import { getVisStateDir } from "./vis-paths";

const SPONSOR_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const SPONSOR_URL = "https://github.com/sponsors/prisis";
const STATE_FILE = join(getVisStateDir(), "sponsor.json");

interface SponsorContext {
    success: boolean;
    visConfig?: VisConfig;
}

interface SponsorState {
    lastShown: number;
}

const readState = (): SponsorState => {
    try {
        if (isAccessibleSync(STATE_FILE)) {
            return readJsonSync(STATE_FILE) as unknown as SponsorState;
        }
    } catch {
        // Corrupted state, reset
    }

    return { lastShown: 0 };
};

const writeState = (state: SponsorState): void => {
    try {
        ensureDirSync(getVisStateDir());
        writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch {
        // Non-critical
    }
};

/**
 * Show the sponsor notice if rate-limits and opt-outs allow.
 */
const showSponsorNotice = (context: SponsorContext): void => {
    if (!context.success) {
        return;
    }

    if (process.env.VIS_CLI_TEST || isInCi) {
        return;
    }

    if (process.env.VIS_NO_SPONSOR === "1") {
        return;
    }

    if (context.visConfig?.sponsor?.enabled === false) {
        return;
    }

    if (!process.stderr.isTTY) {
        return;
    }

    const now = Date.now();
    const state = readState();

    if (now - state.lastShown < SPONSOR_INTERVAL_MS) {
        return;
    }

    process.stderr.write(
        `\n${magenta("♥")} ${bold("Enjoying visulima?")} ${dim(`Consider sponsoring at ${SPONSOR_URL}`)}\n${dim("   Hide this with VIS_NO_SPONSOR=1 or sponsor.enabled = false in vis.config.ts")}\n`,
    );

    writeState({ lastShown: now });
};

export type { SponsorContext };
export { showSponsorNotice, SPONSOR_INTERVAL_MS, SPONSOR_URL };
