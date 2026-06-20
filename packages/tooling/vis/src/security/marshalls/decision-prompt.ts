/**
 * Shared prompt + auto-continue countdown used by every marshall-aware
 * command (`vis add`, `vis install`, `vis update`, `vis inspect`).
 *
 * Decision matrix — see plan §10 for the full prose, distilled here:
 *
 * | Findings | TTY? | CI? | strict? | env disabled? | Outcome                                  |
 * | -------- | ---- | --- | ------- | ------------- | ---------------------------------------- |
 * | none     | *    | *   | *       | *             | `{ proceed: true }`                      |
 * | errors   | *    | *   | true    | *             | `{ proceed: false, errors-present }`     |
 * | errors   | *    | yes | false   | *             | `{ proceed: false, errors-present }`     |
 * | errors   | yes  | no  | false   | *             | prompt y/N, no countdown                 |
 * | errors   | no   | no  | false   | *             | `{ proceed: false, non-tty }`            |
 * | warnings | *    | *   | true    | *             | `{ proceed: false, ci-strict }`          |
 * | warnings | yes  | no  | false   | no            | print + 15s countdown, then proceed      |
 * | warnings | yes  | no  | false   | yes           | prompt y/N, no countdown                 |
 * | warnings | no   | *   | false   | *             | auto-proceed                             |
 *
 * The countdown rewrites a single line via `\r` so the terminal stays compact.
 * Dumb / unknown TERMs print a single line and skip the rewrite — see
 * `shouldAnimateCountdown` below.
 * @example
 * ```ts
 * const result = await presentMarshallDecision(findings.all(), { strict });
 *
 * if (!result.proceed) {
 *     pail.error(`Aborting (${result.reason}).`);
 *     process.exit(result.reason === "user-aborted" ? 130 : 1);
 * }
 * ```
 */

import isInCi from "is-in-ci";

import { isTruthyEnv } from "../../util/env";
import { defaultReadline, promptYesNo } from "../../util/prompt";
import type { MarshallFinding, MarshallFindings } from "./findings";
import { formatMarshallFindingsAsTable } from "./findings";

export interface MarshallDecisionOptions {
    /** Override the countdown length (seconds). Defaults to 15. */
    countdownSeconds?: number;
    /** Override `process.env` lookup. */
    env?: NodeJS.ProcessEnv;
    /** Inject a CI predicate for tests. Defaults to the `is-in-ci` module. */
    isCi?: boolean;
    /** Bypass the `process.stdin.isTTY` check (tests inject a TTY-ish stdin). */
    isTty?: boolean;
    /** Where to write countdown / prompt text. Defaults to stdout. */
    output?: { isTTY?: boolean; write: (chunk: string) => void };
    /** Injectable readline factory for tests. */
    readline?: (question: string) => Promise<string>;
    /** Signal that the caller can use to externally abort the countdown. */
    signal?: AbortSignal;
    /** When true, `--strict` semantics: any finding (warning or error) aborts. */
    strict?: boolean;
}

export type MarshallDecisionReason = "ci-strict" | "errors-present" | "non-tty" | "user-aborted";

export type MarshallDecisionResult = { proceed: false; reason: MarshallDecisionReason } | { proceed: true };

const DEFAULT_COUNTDOWN_SECONDS = 15;

/** Dumb / unknown TERMs mis-render `\r`-based animations — fall back to a single static line. */
const shouldAnimateCountdown = (env: NodeJS.ProcessEnv): boolean => {
    const term = (env.TERM ?? "").toLowerCase();

    return term !== "dumb" && term !== "unknown" && term !== "";
};

/**
 * Run the auto-continue countdown. Resolves `true` once the timer elapses,
 * `false` if the supplied signal aborts before then. Tests inject a fake
 * timer-friendly setup by passing their own `signal`.
 */
const runCountdown = async (
    seconds: number,
    output: { isTTY?: boolean; write: (chunk: string) => void },
    env: NodeJS.ProcessEnv,
    signal?: AbortSignal,
): Promise<boolean> =>
    new Promise((resolve) => {
        if (signal?.aborted) {
            resolve(false);

            return;
        }

        const animate = shouldAnimateCountdown(env) && output.isTTY !== false;
        let remaining = seconds;

        const render = (): void => {
            if (animate) {
                // `\r` rewrites the line; pad with spaces so shorter values don't leave residue.
                output.write(`\rContinuing in ${String(remaining)}s... press Ctrl-C to abort.   `);
            } else if (remaining === seconds) {
                output.write(`Warnings present; proceeding in ${String(seconds)}s.\n`);
            }
        };

        render();

        const timer = setInterval(() => {
            remaining -= 1;

            if (remaining <= 0) {
                clearInterval(timer);
                signal?.removeEventListener("abort", onAbort);

                if (animate) {
                    output.write("\rContinuing now.                              \n");
                }

                resolve(true);

                return;
            }

            render();
        }, 1000);

        const onAbort = (): void => {
            clearInterval(timer);

            if (animate) {
                output.write("\rAborted.                                      \n");
            }

            resolve(false);
        };

        signal?.addEventListener("abort", onAbort, { once: true });
    });

/**
 * Resolve a decision for a batch of marshall findings.
 *
 * Pure with respect to the inputs: behavior is driven entirely by `options`
 * (which supplies env, TTY, CI, readline injectables) so the function is
 * deterministic and testable without `vi.mock`'ing globals everywhere.
 */
export const presentMarshallDecision = async (
    findings: ReadonlyArray<MarshallFinding>,
    options: MarshallDecisionOptions = {},
): Promise<MarshallDecisionResult> => {
    if (findings.length === 0) {
        return { proceed: true };
    }

    const env = options.env ?? process.env;
    const isTty = options.isTty ?? Boolean(process.stdin.isTTY);
    const ci = options.isCi ?? isInCi;
    const strict = options.strict ?? false;
    const readline = options.readline ?? defaultReadline;
    const output = options.output ?? { isTTY: Boolean(process.stdout.isTTY), write: (chunk: string) => process.stdout.write(chunk) };
    const autoContinueDisabled = isTruthyEnv(env.VIS_DISABLE_AUTO_CONTINUE);
    const envSeconds = Number.parseInt(env.VIS_AUTO_CONTINUE_SECONDS ?? "", 10);
    const countdownSeconds = options.countdownSeconds ?? (Number.isFinite(envSeconds) && envSeconds > 0 ? envSeconds : DEFAULT_COUNTDOWN_SECONDS);

    const hasErrors = findings.some((finding) => finding.severity === "error");

    if (hasErrors) {
        if (strict) {
            return { proceed: false, reason: "errors-present" };
        }

        if (ci) {
            return { proceed: false, reason: "errors-present" };
        }

        if (!isTty) {
            return { proceed: false, reason: "non-tty" };
        }

        const proceed = await promptYesNo("Proceed despite errors? [y/N] ", readline);

        return proceed ? { proceed: true } : { proceed: false, reason: "user-aborted" };
    }

    // Warnings-only from here on.
    if (strict) {
        return { proceed: false, reason: "ci-strict" };
    }

    if (!isTty) {
        // CI / piped output: auto-proceed silently.
        return { proceed: true };
    }

    if (autoContinueDisabled) {
        const proceed = await promptYesNo("Proceed despite warnings? [y/N] ", readline);

        return proceed ? { proceed: true } : { proceed: false, reason: "user-aborted" };
    }

    const completed = await runCountdown(countdownSeconds, output, env, options.signal);

    return completed ? { proceed: true } : { proceed: false, reason: "user-aborted" };
};

export interface PresentMarshallFindingsOptions extends Pick<
    MarshallDecisionOptions,
    "countdownSeconds" | "isCi" | "isTty" | "readline" | "signal" | "strict"
> {
    /** Stream to flush the human-readable table to. Defaults to stdout. */
    output?: { isTTY?: boolean; write: (chunk: string) => void };
}

/**
 * Pretty-print marshall findings, then route through
 * {@link presentMarshallDecision} (auto-continue countdown / y-N prompt /
 * CI-strict gate). Returns `true` if the caller should proceed with the
 * install, `false` if the user aborted or a hard rule prevented it.
 *
 * Callers are responsible for setting `process.exitCode` when the result
 * is `false` — this helper stays I/O-pure with respect to the parent
 * command's exit semantics.
 */
export const presentMarshallFindings = async (findings: MarshallFindings, options: PresentMarshallFindingsOptions = {}): Promise<boolean> => {
    if (findings.isEmpty()) {
        return true;
    }

    const snapshot = findings.all();
    const output = options.output ?? { isTTY: Boolean(process.stdout.isTTY), write: (chunk: string) => process.stdout.write(chunk) };

    for (const line of formatMarshallFindingsAsTable(snapshot)) {
        output.write(`${line}\n`);
    }

    const result = await presentMarshallDecision(snapshot, {
        countdownSeconds: options.countdownSeconds,
        isCi: options.isCi,
        isTty: options.isTty,
        output,
        readline: options.readline,
        signal: options.signal,
        strict: options.strict,
    });

    return result.proceed;
};
