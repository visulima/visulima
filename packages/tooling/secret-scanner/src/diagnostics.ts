import type { Native } from "./binding";
import { binding } from "./binding";
import type { SkippedRule } from "./types";

let warnedOnce = false;

/**
 * One-shot diagnostic: list rules that failed to compile in the native side.
 * Runs at most once per process (across every `scan()` / `scanFiles()` call)
 * so users who misconfigure a custom rule see the warning on the first scan
 * and aren't spammed on every re-scan. Diagnostics are best-effort — a failure
 * here never breaks the outer scan.
 */
export const warnOnSkippedRules = async (resolved: Native.ScanOptions): Promise<void> => {
    if (warnedOnce) {
        return;
    }

    warnedOnce = true;

    try {
        const skipped = binding.inspectRuleset(resolved) as SkippedRule[];

        if (skipped.length === 0) {
            return;
        }

        /* eslint-disable no-console -- Diagnostic output; stderr is the intended channel for library warnings. */
        console.error(`secret-scanner: ${String(skipped.length)} rule(s) skipped due to invalid regex:`);

        for (const entry of skipped.slice(0, 10)) {
            console.error(`  - ${entry.ruleId}: ${entry.reason}`);
        }

        if (skipped.length > 10) {
            console.error(`  ... and ${String(skipped.length - 10)} more`);
        }
        /* eslint-enable no-console */
    } catch {
        // Diagnostics are best-effort; don't break the scan on a failure here.
    }
};

/** Test-only: reset the once-per-process warning gate. */
export const resetDiagnosticsForTests = (): void => {
    warnedOnce = false;
};
