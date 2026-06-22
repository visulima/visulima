/**
 * Post-publish notification walk — semantic-release parity (`successComment`
 * + `releasedLabels`).
 *
 * Once a publish wave has succeeded and tags are pushed, walk every PR / issue
 * mentioned in the rendered changelog entries and:
 *
 *   1. Upsert a sticky comment announcing the release version
 *      (marker `&lt;!-- vis-release-success -->`).
 *   2. Add the configured labels (default `["released"]`).
 *
 * The walk runs inside `publishContext` after `createRemoteReleases`; every
 * call is wrapped in soft-fail handling so a forge-side hiccup on a single
 * ref doesn't roll back the rest of the wave (the publish itself already
 * landed).
 *
 * Reference extraction supports the two most common forms used in vis
 * change-files and conventional commit footers:
 *
 *   - `#123`     — bare GitHub-style reference
 *   - `gh-123`   — alternate prefix used by some teams to disambiguate
 *
 * URLs that already point at a PR (`https://github.com/x/y/pull/123`,
 * `https://gitlab.com/x/y/-/merge_requests/123`) are also picked up so links
 * embedded in change-file bodies don't drop on the floor.
 *
 * Refs are deduped across every release in the wave — if a single PR shows
 * up in the changelogs of three packages we still only comment / label it
 * once.
 */

import type { PlannedRelease } from "../types";
import type { ChangelogFormatter } from "./changelog/api";
import type { OrchestratorContext, PublishContextResult } from "./orchestrator";
import type { CommandRunner } from "./package-managers/interface";
import type { RemoteReleaseClient } from "./remote/interface";

/** Stable marker used by the sticky-comment upsert path. */
export const SUCCESS_WALK_MARKER = "<!-- vis-release-success -->";

/** Default labels appended to walked PRs / issues. */
export const DEFAULT_SUCCESS_WALK_LABELS = ["released"];

/**
 * Default comment template — mirrors semantic-release's `successComment`
 * with the marker prepended so the upsert path can find it on re-runs.
 */
export const DEFAULT_SUCCESS_WALK_COMMENT
    = `${SUCCESS_WALK_MARKER}\n:tada: This issue has been resolved in version {version} :tada:\n\nThe release is available on [GitHub release]({url}).\n\nYour **[vis](https://github.com/visulima/visulima)** release pipeline shipped this. :rocket:`;

/**
 * Extract every PR / issue reference from a rendered changelog body. Both
 * `#123` and `gh-123` forms are accepted; numbers are deduped at the caller.
 *
 * Two guardrails worth pointing out:
 *
 *   1. The `#123` regex is anchored to a non-word boundary on the left to
 *      avoid matching colour hex codes (`color: #ff00ff`), Markdown anchor
 *      links (`[foo](#section)`), and other false positives. Practically:
 *      a `#` only counts when preceded by whitespace, start-of-string, or
 *      a punctuation character.
 *   2. The `gh-` prefix is matched case-insensitively but the captured
 *      number is returned as a plain int — the caller doesn't care which
 *      casing the source used.
 *
 * Forge URLs (`/pull/123`, `/issues/123`, `/-/merge_requests/123`) are also
 * scraped so an entry like
 * `See https://github.com/x/y/pull/45 for details` shows up in the walk.
 *
 * **Cross-repo guardrail:** when `repo` is provided (`"owner/name"`), URL-
 * shaped refs are dropped unless the URL's host+path matches that repo.
 * Otherwise a competitor's PR URL pasted into a change-file body
 * (`https://github.com/competitor/repo/pull/42`) would cause vis to
 * comment on its own repo's #42. Bare refs (`#123`, `gh-123`) are always
 * kept since by convention they refer to the local repo.
 */
export const extractReferences = (body: string, repo?: string): number[] => {
    const found = new Set<number>();

    // #123 — but only when preceded by whitespace, start-of-line, or a
    // common punctuation char. The negative lookbehind would be cleaner,
    // but lookbehinds are not universally supported in older Node — use a
    // positive boundary check instead.
    const hashRegex = /(?:^|[\s(,;:!?])#(\d+)/g;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = hashRegex.exec(body)) !== null) {
        const num = Number.parseInt(match[1]!, 10);

        if (Number.isFinite(num) && num > 0) {
            found.add(num);
        }
    }

    // gh-123 / GH-123
    const ghRegex = /\bgh-(\d+)/gi;

    // eslint-disable-next-line no-cond-assign
    while ((match = ghRegex.exec(body)) !== null) {
        const num = Number.parseInt(match[1]!, 10);

        if (Number.isFinite(num) && num > 0) {
            found.add(num);
        }
    }

    // Forge URLs — /pull/N (GitHub), /issues/N (both), /-/merge_requests/N
    // (GitLab). The host+path is checked against `repo` so a competitor's
    // URL pasted into a change-file body doesn't get applied locally.
    // We intentionally don't restrict to a specific host so self-hosted
    // GHE / GitLab instances are picked up too — only the path segment
    // (the `owner/name` portion of the URL) needs to match.
    //
    // Capture groups:
    //   [1] host (e.g. `github.com`)
    //   [2] path segment between host and the resource keyword (the
    //       `owner/name` part — empty when the URL has no repo prefix)
    //   [3] numeric id (the resource keyword is matched but not captured)
    const urlRegex = /https?:\/\/([^\s/]+)\/([^\s)]*?)\/(?:pull|issues|merge_requests)\/(\d+)/gi;

    // eslint-disable-next-line no-cond-assign
    while ((match = urlRegex.exec(body)) !== null) {
        const num = Number.parseInt(match[3]!, 10);

        if (!(Number.isFinite(num) && num > 0)) {
            continue;
        }

        if (repo) {
            // The URL's path segment is everything between the host and the
            // `/pull/N` (or `/issues/N` or `/merge_requests/N`) tail. GitLab
            // MRs structure the path as `<owner>/<name>/-/merge_requests/N`
            // — strip a trailing `/-` so the comparison against `<owner>/<name>`
            // still works. Trailing/leading slashes trimmed on both sides.
            const pathSegment = (match[2] ?? "")
                .replaceAll(/^\/+|\/+$/g, "")
                .replace(/\/-$/, "");
            const expected = repo.replaceAll(/^\/+|\/+$/g, "");

            if (pathSegment.toLowerCase() !== expected.toLowerCase()) {
                continue;
            }
        }

        found.add(num);
    }

    return [...found].sort((a, b) => a - b);
};

/**
 * Expand the comment-body template's tokens. Identical token set to the
 * extra-files applier so users learn one substitution language.
 *
 * F3 fix (audit): when `vars.url` is empty (the common case when the
 * operator opts into `publish.noRelease: true` and no forge release is
 * created), naive `replaceAll` would emit `[GitHub release]()` — a
 * broken markdown link consumers see in their sticky comments.
 *
 * To avoid that, every `{url}` placeholder is first considered in its
 * surrounding markdown-link context: `[&lt;text>]({url})` collapses to
 * `&lt;package>@&lt;version>` plain text when the URL is empty. Remaining
 * bare `{url}` occurrences fall back to the same `name@version` plain
 * text. A non-empty URL flows through exactly as before.
 */
const expandTemplate = (template: string, vars: { name: string; tag: string; url: string; version: string }): string => {
    let out = template;

    if (vars.url) {
        out = out.replaceAll("{url}", vars.url);
    } else {
        const fallback = `${vars.name}@${vars.version}`;

        // Collapse `[<text>]({url})` → plain `name@version`. Anchored
        // tightly so unrelated markdown links in the template aren't
        // disturbed.
        out = out.replaceAll(/\[[^\]]*\]\(\{url\}\)/g, fallback);

        // Any leftover bare `{url}` falls back to the same plain text
        // so we never emit an empty parenthesis pair.
        out = out.replaceAll("{url}", fallback);
    }

    return out
        .replaceAll("{version}", vars.version)
        .replaceAll("{name}", vars.name)
        .replaceAll("{tag}", vars.tag);
};

export interface WalkSuccessfulReleaseDeps {
    /** Resolved provider client. Injected so tests don't need network. */
    client: RemoteReleaseClient;
    /** Rendered changelog formatter. */
    formatter: ChangelogFormatter;
    /** Repo slug ("owner/name"); when undefined the walk is a no-op. */
    repo: string | undefined;
}

export interface WalkSuccessfulReleaseResult {
    /** Refs the walk successfully commented on. */
    commented: number[];
    /** Refs the walk successfully labelled. */
    labeled: number[];
    /** Soft-fail warnings — surfaced through plan.warnings by the caller. */
    warnings: string[];
}

/**
 * Resolve the runtime `SuccessWalkConfig` from `context.config.successWalk`.
 * Applies defaults so call-sites don't have to re-derive them.
 */
const resolveConfig = (context: OrchestratorContext): { commentBody: string; enabled: boolean; labels: string[]; skipPrerelease: boolean } => {
    const cfg = context.config.successWalk ?? {};

    return {
        commentBody: cfg.commentBody ?? DEFAULT_SUCCESS_WALK_COMMENT,
        enabled: cfg.enabled !== false,
        labels: cfg.labels ?? DEFAULT_SUCCESS_WALK_LABELS,
        skipPrerelease: cfg.skipPrerelease !== false,
    };
};

/**
 * Render each published release's changelog body once and concatenate the
 * extracted refs. The formatter result is target=`github-release` so we
 * don't pull in the `## version` header (the comment template handles
 * version display itself).
 */
const collectReferences = async (
    context: OrchestratorContext,
    result: PublishContextResult,
    formatter: ChangelogFormatter,
    repo: string,
): Promise<{ firstReleaseByRef: Map<number, PlannedRelease>; refs: number[] }> => {
    const refs = new Set<number>();
    const firstReleaseByRef = new Map<number, PlannedRelease>();

    const date = new Date().toISOString().slice(0, 10);

    for (const published of result.published) {
        const release = context.plan.releases.find((r) => r.name === published.name);

        if (!release) {
            continue;
        }

        let body: string;

        try {
            body = await formatter({
                changeFiles: release.changeFiles,
                date,
                release,
                target: "github-release",
            });
        } catch {
            // A broken custom formatter shouldn't stop us from walking the
            // remaining releases — just skip this one.
            continue;
        }

        // Also harvest refs directly from the change-file bodies, in case
        // the active formatter strips them (the github formatter, for
        // example, can rewrite `#123` into resolved markdown links). Pass
        // the local `repo` so URL-shaped refs pointing at other repos are
        // dropped (see `extractReferences`).
        const combined = [body, ...release.changeFiles.map((f) => f.body)].join("\n");

        for (const ref of extractReferences(combined, repo)) {
            if (!firstReleaseByRef.has(ref)) {
                firstReleaseByRef.set(ref, release);
            }

            refs.add(ref);
        }
    }

    return { firstReleaseByRef, refs: [...refs].sort((a, b) => a - b) };
};

/**
 * Look up the release URL the publish wave recorded for a given package.
 * Per-package GH releases are created via `client.createRelease` in
 * `createRemoteReleases`; the URL flows through `result.published[].url`
 * once that helper records it. Aggregate-release mode has a single URL
 * which we use for every ref.
 */
const resolveReleaseUrl = (release: PlannedRelease | undefined, result: PublishContextResult): string => {
    if (!release) {
        return "";
    }

    const published = result.published.find((p) => p.name === release.name);

    return (published as { url?: string } | undefined)?.url ?? "";
};

/**
 * Tiny concurrency limiter — `n` tasks run in flight at a time, the rest
 * queue. Returns a function with the same shape as a promise factory
 * (`() => Promise&lt;T>`), wrapped to enforce the cap.
 *
 * Implemented inline to avoid adding a `p-limit` dep just for this single
 * use site. The two semantics that matter for the walk:
 *
 *   1. The returned promise resolves in submission order (not completion
 *      order) — callers `Promise.all` the wrapped factories and rely on
 *      indexed positions.
 *   2. Rejections propagate via the inner promise; the limiter itself
 *      never throws. This lines up with the existing soft-fail behaviour
 *      where each ref's failure is captured locally and turned into a
 *      `warnings[]` entry.
 *
 * Exported for testability — `__tests__/release/core/success-walk.test.ts`
 * uses it to assert the cap on in-flight workers.
 */
export const pLimit = <T = unknown>(n: number): ((task: () => Promise<T>) => Promise<T>) => {
    let active = 0;
    const queue: (() => void)[] = [];

    const next = (): void => {
        if (active >= n) {
            return;
        }

        const job = queue.shift();

        if (job) {
            active += 1;
            job();
        }
    };

    return (task) => new Promise<T>((resolve, reject) => {
        const onSettled = (): void => {
            active -= 1;
            next();
        };

        const run = (): void => {
            // The reject handler passed to then() captures every rejection;
            // catch-or-return is satisfied by returning the settled chain.
            // eslint-disable-next-line promise/catch-or-return -- rejection handled by the reject handler passed to then()
            task()
                .then(resolve, reject)
                .finally(onSettled);
        };

        queue.push(run);
        next();
    });
};

/**
 * Sleep helper used by the 429 backoff path. Promise-based so callers
 * `await` it inline. The retry layer caps at one retry per call so the
 * worst-case extra latency per ref is one Retry-After header value.
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

/**
 * Detect whether an error thrown by `RemoteReleaseClient` was a 429 / rate
 * limit. The forge clients today wrap `gh`/`glab` CLI output; the message
 * field is the most reliable signal across both. We also peek at a
 * `status` field for forge-clients that surface fetch-style errors
 * directly (future hardening).
 */
const isRateLimit = (error: unknown): boolean => {
    if (!error || typeof error !== "object") {
        return false;
    }

    const e = error as { message?: unknown; status?: unknown; statusCode?: unknown };

    if (typeof e.status === "number" && e.status === 429) {
        return true;
    }

    if (typeof e.statusCode === "number" && e.statusCode === 429) {
        return true;
    }

    if (typeof e.message === "string") {
        // `gh` surfaces "HTTP 429" in stderr when it hits the rate limit;
        // we also catch the textual "rate limit" phrase for clients that
        // format it differently.
        return /\b429\b|rate[- ]?limit/i.test(e.message);
    }

    return false;
};

/**
 * Extract the `Retry-After` value (seconds) from a thrown error. The forge
 * adapters tuck the header into either `error.retryAfter` (numeric) or a
 * `Retry-After: N` line inside `error.message`. Falls back to the default
 * when neither is present.
 */
const parseRetryAfter = (error: unknown, defaultMs: number): number => {
    if (!error || typeof error !== "object") {
        return defaultMs;
    }

    const e = error as { message?: unknown; retryAfter?: unknown };

    if (typeof e.retryAfter === "number" && Number.isFinite(e.retryAfter) && e.retryAfter >= 0) {
        return Math.round(e.retryAfter * 1000);
    }

    if (typeof e.message === "string") {
        const match = /Retry-After:\s*(\d+)/i.exec(e.message);

        if (match) {
            const seconds = Number.parseInt(match[1]!, 10);

            if (Number.isFinite(seconds) && seconds >= 0) {
                return seconds * 1000;
            }
        }
    }

    return defaultMs;
};

/**
 * Run `op` once. On a 429-style error, sleep for the `Retry-After` header
 * value (or `defaultRetryAfterMs`) and retry exactly once. Any other
 * error or a 429 on the retry attempt propagates to the caller — the
 * existing soft-fail layer turns it into a `warnings[]` entry.
 *
 * Exported for testability — the M-8 regression test injects a fake
 * client that throws a 429 on first call and succeeds on retry.
 */
export const withRateLimitRetry = async <T = unknown>(
    op: () => Promise<T>,
    defaultRetryAfterMs = 5000,
): Promise<T> => {
    try {
        return await op();
    } catch (error) {
        if (!isRateLimit(error)) {
            throw error;
        }

        const delayMs = parseRetryAfter(error, defaultRetryAfterMs);

        await sleep(delayMs);

        return op();
    }
};

/**
 * Walk every PR / issue ref harvested from the published wave's changelogs
 * and (a) post a sticky comment, (b) add the configured labels.
 *
 * Soft-fail semantics: a single bad ref appends a warning but the walk
 * continues. The aggregate result is returned so callers can surface
 * warnings via `plan.warnings`.
 *
 * Concurrency: refs are processed in parallel with a cap of 4 in-flight
 * workers (`pLimit(4)`). Each worker makes up to two forge calls (sticky
 * comment + label) and re-tries each call once on a 429 with the server-
 * supplied `Retry-After` delay. For a wave touching 200 PRs that's at
 * most 50 batches of 8 round-trips, with the rate-limit retry as a
 * safety net.
 *
 * **Default OFF.** The walk only runs when `context.config.successWalk`
 * is explicitly defined AND `enabled !== false`. Leaving `successWalk`
 * undefined is the recommended stance — see `SuccessWalkConfig` docstring.
 */
export const walkSuccessfulRelease = async (
    context: OrchestratorContext,
    result: PublishContextResult,
    runner: CommandRunner,
    deps: WalkSuccessfulReleaseDeps,
): Promise<WalkSuccessfulReleaseResult> => {
    const out: WalkSuccessfulReleaseResult = { commented: [], labeled: [], warnings: [] };

    // C-1 gate: never apply sticky comments / labels to third-party PRs
    // by accident. The walk is opt-in — operators must explicitly
    // configure `successWalk` (even an empty `{}` is fine) to enable it.
    if (context.config.successWalk === undefined) {
        return out;
    }

    const cfg = resolveConfig(context);

    if (!cfg.enabled) {
        return out;
    }

    // Bail on prerelease channels by default — the typical case is "don't
    // notify users their PR shipped in a beta before stable". The
    // skip-prerelease guard inspects both the channel's prerelease marker
    // and the published versions themselves (-rc / -alpha / etc.) so the
    // guardrail still kicks in when a release was prereleased without a
    // channel having been declared.
    const isPrerelease = Boolean(context.channel?.prerelease)
        || result.published.some((p) => p.version.includes("-"));

    if (cfg.skipPrerelease && isPrerelease) {
        return out;
    }

    if (!deps.repo) {
        return out;
    }

    const { firstReleaseByRef, refs } = await collectReferences(context, result, deps.formatter, deps.repo);

    if (refs.length === 0) {
        return out;
    }

    const channelTag = context.channel?.tag ?? "";
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- pLimit's type parameter is the task return type; these tasks resolve to void.
    const limit = pLimit<void>(4);

    const tasks = refs.map((ref) => limit(async () => {
        const release = firstReleaseByRef.get(ref);
        const version = release?.newVersion ?? result.published[0]?.version ?? "";
        const name = release?.name ?? result.published[0]?.name ?? "";
        const url = resolveReleaseUrl(release, result);
        const body = expandTemplate(cfg.commentBody, { name, tag: channelTag, url, version });

        // 1. Sticky comment. Marker is appended automatically when the
        //    template doesn't already include it, so a user-supplied
        //    template can't accidentally lose update semantics on re-run.
        const finalBody = body.includes(SUCCESS_WALK_MARKER) ? body : `${SUCCESS_WALK_MARKER}\n${body}`;

        try {
            const upsert = await withRateLimitRetry(() => deps.client.upsertStickyComment(runner, {
                body: finalBody,
                cwd: context.cwd,
                issueNumber: ref,
                marker: SUCCESS_WALK_MARKER,
                repo: deps.repo as string,
            }));

            if (upsert) {
                out.commented.push(ref);
            } else {
                out.warnings.push(`successWalk: upsertStickyComment returned undefined for #${ref}; skipping label step.`);

                return;
            }
        } catch (error) {
            out.warnings.push(`successWalk: failed to comment on #${ref}: ${(error as Error).message}`);

            return;
        }

        // 2. Labels. Empty `labels: []` is a valid config — skip the call
        //    entirely so we don't waste a round-trip.
        if (cfg.labels.length === 0) {
            return;
        }

        try {
            const ok = await withRateLimitRetry(() => deps.client.addLabels(runner, {
                cwd: context.cwd,
                issueNumber: ref,
                labels: cfg.labels,
                repo: deps.repo as string,
            }));

            if (ok) {
                out.labeled.push(ref);
            } else {
                out.warnings.push(`successWalk: addLabels returned false for #${ref}; the labels may not have been applied.`);
            }
        } catch (error) {
            out.warnings.push(`successWalk: failed to label #${ref}: ${(error as Error).message}`);
        }
    }));

    await Promise.all(tasks);

    // Sort the result arrays so test/observation order is deterministic
    // (parallel execution scrambles the natural insertion order).
    out.commented.sort((a, b) => a - b);
    out.labeled.sort((a, b) => a - b);

    return out;
};
