/**
 * Staged-publishing helpers.
 *
 * npm's `stage publish` returns immediately with a `stageId`; there is no
 * push notification for approval. `waitForStageDecision` polls the registry
 * until the staged record is gone (decision was made), then disambiguates
 * approval vs rejection by checking whether `&lt;pkg>@&lt;version>` is now live.
 *
 * Polling-not-callback is a registry constraint, not a vis choice — see
 * RFC §13.6. We block the publish step on the decision so subsequent
 * pipeline steps (tags, GH release, post-hooks) only fire against a
 * package that's actually installable.
 *
 * DX note: rejection and timeout are **not** treated as CI failures. A
 * "no" from a reviewer is a normal outcome of the review gate, not a bug;
 * a timeout is recoverable (re-run when the team is ready). Both flow
 * through the orchestrator's `result.skipped[]` so `vis release publish`
 * exits 0, but downstream side-effects (tags, GH release, post-hooks)
 * skip the unapproved packages naturally because they iterate
 * `result.published[]`.
 */

import { setTimeout as sleep } from "node:timers/promises";

import { VisReleaseError } from "../errors";
import type { CommandRunner } from "./package-managers/interface";

export type StageDecision = "approved" | "rejected" | "timeout";

export interface WaitForStageDecisionOptions {
    /** Workspace cwd; passed through to the runner. */
    cwd: string;
    /** Optional callback fired each iteration; useful for log spinners. */
    onProgress?: (elapsedMs: number) => void;
    /** Package name to disambiguate post-decision (`npm view &lt;pkg>@&lt;version>`). */
    packageName: string;
    /** Sleep between consecutive `npm stage view` checks. */
    pollIntervalMs: number;
    /** Subprocess runner — injected for testability. */
    runner: CommandRunner;
    /** Stage id returned by `npm stage publish --json`. */
    stageId: string;
    /** Hard deadline before the wait fails with "timeout". */
    timeoutMs: number;
    /** Version that was staged. */
    version: string;
}

/**
 * Block until the registry reports the stage as either promoted or
 * rejected, or until `timeoutMs` elapses.
 *
 * Detection sequence:
 *   1. `npm stage view &lt;id> --json` — while the record exists, sleep + retry.
 *   2. Once `view` returns empty / errors with "not found", the decision
 *      was made. Disambiguate via `npm view &lt;pkg>@&lt;version> dist.tarball`:
 *      a non-empty tarball URL means approved; anything else means rejected.
 *
 * Trusted-publishing caveat: the disambiguation GET on step 2 needs read
 * auth for restricted packages. We refuse the OIDC + restricted combo at
 * publish time (RFC §13.6); for public packages the GET is unauthenticated.
 */
export const waitForStageDecision = async (
    options: WaitForStageDecisionOptions,
): Promise<StageDecision> => {
    const start = Date.now();
    const stageStillPresent = (stdout: string): boolean => {
        const trimmed = stdout.trim();

        if (!trimmed) {
            return false;
        }

        try {
            const parsed = JSON.parse(trimmed) as { id?: string };

            return typeof parsed.id === "string";
        } catch {
            return false;
        }
    };

    while (Date.now() - start < options.timeoutMs) {
        const view = await options.runner.run(
            "npm",
            ["stage", "view", options.stageId, "--json"],
            { cwd: options.cwd, silent: true },
        );

        const stillStaged = view.exitCode === 0 && stageStillPresent(view.stdout);

        if (!stillStaged) {
            // Decision made (or stage id no longer exists). Probe the live
            // registry to disambiguate approve vs reject.
            const live = await options.runner.run(
                "npm",
                ["view", `${options.packageName}@${options.version}`, "dist.tarball", "--silent"],
                { cwd: options.cwd, silent: true },
            );

            return live.exitCode === 0 && live.stdout.trim() ? "approved" : "rejected";
        }

        options.onProgress?.(Date.now() - start);
        await sleep(options.pollIntervalMs);
    }

    return "timeout";
};

/**
 * Refuse to stage a restricted-access package when OIDC trusted publishing
 * is the only auth in scope. The post-decision disambiguation GET needs
 * read auth for restricted packages; OIDC tokens are write-only for
 * publish + don't survive into the registry-read step. Lifting this gate
 * requires either a fallback `NPM_TOKEN` (out of scope for v1) or proper
 * stage-decision webhooks from npm Inc (none documented yet).
 */
export const refuseRestrictedOidc = (
    publishConfigAccess: string | undefined,
    env: NodeJS.ProcessEnv = process.env,
): void => {
    const isRestricted = publishConfigAccess === "restricted";
    const isOidc = Boolean(env["ACTIONS_ID_TOKEN_REQUEST_URL"]) && !env["NPM_TOKEN"];

    if (isRestricted && isOidc) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: "Either set publish.stage: false, or fall back to NPM_TOKEN authentication (export NPM_TOKEN; trusted publishing on restricted packages is tracked for a future release).",
            message: "publish.stage with OIDC trusted publishing is not supported for restricted-access packages in v1.",
        });
    }
};
