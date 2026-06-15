/**
 * Conventional-commit derivation helpers used by `vis release generate`.
 *
 * Pure module — no fs/git/network. Each function operates on the commit
 * records the handler reads via a single sentinel-delimited `git log`
 * invocation.
 *
 * Revert handling (release-please #296 parity)
 * --------------------------------------------
 * When a conventional commit is reverted, both its changelog entry AND
 * its bump contribution must be cancelled. Two revert shapes are
 * recognised:
 *
 *   1. `revert: &lt;subject>` — explicit conventional-commits convention.
 *      The original commit is matched by exact subject string.
 *   2. `Revert "&lt;subject>"` — default git revert message. Same subject
 *      match, plus a `This reverts commit &lt;sha>` line in the body lets
 *      us match the original by SHA when subjects collide or were
 *      tweaked.
 *
 * Reverting an already-released commit (sha older than the last release
 * tag) is a no-op: vis can't unrelease a shipped version, and dropping
 * the bump now would produce an under-specified plan. The function
 * accepts a `releasedSet` of already-shipped SHAs so callers can wire in
 * `git log --oneline &lt;last-tag>..HEAD` once and reuse the result.
 *
 * Double revert (revert-of-revert) re-applies the original change. The
 * cancellation logic walks revert pairs greedily — a revert that
 * cancels an already-cancelled revert flips the original back to
 * active.
 */

import { CommitParser } from "conventional-commits-parser";

import type { BumpLevel } from "../../types";

export const CC_TYPE_TO_BUMP: Record<string, BumpLevel> = {
    build: "patch",
    chore: "patch",
    ci: "patch",
    docs: "patch",
    feat: "minor",
    fix: "patch",
    perf: "patch",
    refactor: "patch",
    style: "patch",
    test: "patch",
};

export interface CommitRecord {
    body: string;
    files: string[];
    hash: string;
    subject: string;
}

export interface ParsedCommit {
    breaking: boolean;
    scope?: string;
    type?: string;
}

export interface AnnotatedCommit extends CommitRecord {
    /**
     * True when this commit has been cancelled by a later revert. A
     * cancelled commit must NOT contribute to the bump map, changelog
     * subject list, or scope-derived target set.
     */
    cancelled: boolean;
    /** The commit (by hash) that cancelled this one, if any. */
    cancelledBy?: string;
    /** Parsed conventional-commits header. */
    parsed: ParsedCommit;
    /** True for `revert: …` / `Revert "…"` commits. */
    revert: boolean;

    /**
     * Subject of the commit being reverted, extracted from either the
     * `revert: &lt;subject>` header or the `Revert "&lt;subject>"` git default.
     * Undefined when the commit isn't a revert.
     */
    revertSubject?: string;

    /**
     * SHA referenced in the revert body's `This reverts commit &lt;sha>`
     * trailer. Undefined when absent.
     */
    revertTargetSha?: string;
}

const commitParser = new CommitParser();

const REVERT_HEADER_RE = /^Revert\s+"(.+)"\s*$/;
const REVERT_TRAILER_RE = /This reverts commit\s+([0-9a-f]{7,40})/i;

/**
 * Strip an optional leading gitmoji (`🚀 …`) or `:shortcode:` (`:rocket: …`)
 * prefix before passing the subject to the conventional-commits parser
 * (release-please #2385). The underlying parser bails on any leading
 * non-ASCII glyph, so a `:rocket: feat: add tab completion` would yield
 * `type: undefined` without this strip.
 */
const GITMOJI_PREFIX_REGEX = /^(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}]|:\w+:)\s+/u;

export const parseCommit = (subject: string, body: string): ParsedCommit => {
    // Strip the optional gitmoji prefix so the conventional-commits parser
    // sees `feat: …` regardless of whether the subject was `🚀 feat: …`
    // or `:rocket: feat: …`. Body is unaffected — gitmoji only appears
    // in the subject line.
    const cleanedSubject = subject.replace(GITMOJI_PREFIX_REGEX, "");
    const parsed = commitParser.parse(`${cleanedSubject}\n\n${body}`);
    const breaking = parsed.notes.some((note) => /BREAKING/i.test(note.title));

    return {
        breaking,
        scope: parsed.scope ?? undefined,
        type: parsed.type ?? undefined,
    };
};

/**
 * Detect whether a commit is a revert and extract the original commit's
 * subject + (optional) SHA. Recognises both the `revert: &lt;subject>`
 * conventional-commits convention and the default git
 * `Revert "&lt;subject>"` message format.
 */
export const detectRevert = (subject: string, body: string, parsed: ParsedCommit): {
    isRevert: boolean;
    targetSha?: string;
    targetSubject?: string;
} => {
    let targetSubject: string | undefined;
    let isRevert = false;

    // Case 1: conventional `revert: <subject>`. The parser exposes
    // `type === "revert"`; the original subject is the everything-after-
    // the-colon portion of the raw header.
    if (parsed.type === "revert") {
        isRevert = true;
        const colonIndex = subject.indexOf(":");

        if (colonIndex !== -1) {
            targetSubject = subject.slice(colonIndex + 1).trim();
        }
    } else {
        // Case 2: default git revert — `Revert "<subject>"`.
        const headerMatch = REVERT_HEADER_RE.exec(subject.trim());

        if (headerMatch) {
            isRevert = true;
            targetSubject = headerMatch[1]?.trim();
        }
    }

    // Either case: the body's `This reverts commit <sha>` trailer pins
    // the exact target SHA when present. Useful for disambiguating when
    // a subject has been reused across multiple commits.
    //
    // F17: the trailer regex is /i (accepts uppercase hex like
    // `ABC1234`) so callers can match relaxed message styles, but git
    // emits hashes in lowercase — normalise here so downstream SHA
    // lookups (which compare case-sensitively against git's output)
    // don't silently miss an otherwise-resolvable target.
    let targetSha: string | undefined;
    const trailerMatch = REVERT_TRAILER_RE.exec(body);

    if (trailerMatch) {
        targetSha = trailerMatch[1]?.toLowerCase();
    }

    return { isRevert, targetSha, targetSubject };
};

/**
 * Result of {@link annotateAndResolveReverts}. The annotated commit list
 * is the same shape callers always got back; the `warnings` array is a
 * new slot for cross-cutting observability findings that the caller is
 * expected to surface (e.g. via logger.warn or a release-plan warnings
 * channel). Empty array when nothing of note was detected.
 */
export interface AnnotateAndResolveRevertsResult {
    commits: AnnotatedCommit[];
    warnings: string[];
}

/**
 * Annotate commits with parsed headers + revert detection, then walk the
 * list and mark each `commit/revert-pair` as cancelled (or re-active for
 * revert-of-revert). The walk is order-sensitive — git log lists newest
 * first, so we reverse to chronological order before pairing reverts
 * with their targets.
 *
 * Reverts targeting commits that are already shipped (sha in
 * `releasedShas`) are a no-op — we cannot unrelease, and dropping the
 * bump now would silently lose the patch history.
 * @param commits Commits from `git log &lt;from>..HEAD --name-only`, NEWEST first.
 * @param releasedShas SHAs known to be shipped already (older than last release tag).
 * @param range Optional `&lt;from>..HEAD` range label used for the F19
 * no-type-ratio warning text. Falls back to "&lt;from>..HEAD"
 * when omitted.
 */
export const annotateAndResolveReverts = (
    commits: ReadonlyArray<CommitRecord>,
    releasedShas: ReadonlySet<string> = new Set(),
    range?: string,
): AnnotateAndResolveRevertsResult => {
    // Annotate + parse once.
    const annotated: AnnotatedCommit[] = commits.map((c) => {
        const parsed = parseCommit(c.subject, c.body);
        const { isRevert, targetSha, targetSubject } = detectRevert(c.subject, c.body, parsed);

        return {
            ...c,
            cancelled: false,
            parsed,
            revert: isRevert,
            revertSubject: targetSubject,
            revertTargetSha: targetSha,
        };
    });

    // Walk chronologically (oldest first) so revert-of-revert resolves
    // in the natural order: A → revert(A) cancels A → revert(revert(A))
    // re-activates A.
    const chronological = annotated.toReversed();

    // Index for fast SHA-based lookup. Subject-based lookup walks
    // linearly because subjects aren't unique enough to key on; the
    // candidate set is small (~commits in the current branch range).
    //
    // Value semantics:
    //   - `AnnotatedCommit` — a unique commit claims this prefix.
    //   - `null`            — ambiguity sentinel: two or more commits
    //                         share this prefix, so lookups must fall
    //                         through to the linear-scan fallback in
    //                         `findTarget` (which can still apply
    //                         additional disambiguation if needed).
    //
    // The full SHA is always registered unconditionally — it cannot
    // collide in practice (SHA-1 is 40 chars). Short prefixes (7 ≤
    // len ≤ MAX_PREFIX_INDEX_LENGTH) use first-wins + ambiguity
    // sentinel so the "first commit claims all short slots" footgun
    // that bit the prior implementation can no longer return a wrong
    // target. Prefixes longer than the cap are intentionally not
    // indexed — `core.abbrev` rarely exceeds 12 in the wild, and
    // longer-than-cap refs fall through to the linear scan, which
    // bounds memory at O(N × 6) instead of O(N × 33).
    const MAX_PREFIX_INDEX_LENGTH = 12;
    const byShaPrefix = new Map<string, AnnotatedCommit | null>();

    for (const c of chronological) {
        // Always register the full hash unconditionally — collisions
        // on a 40-char SHA are not a real concern.
        byShaPrefix.set(c.hash, c);

        // F17: index every prefix length from 7 chars up to the cap
        // (or to the full hash length, whichever is shorter). Large
        // repos using `core.abbrev = 11/12` write 11- or 12-char
        // abbreviations into the `This reverts commit <sha>` trailer;
        // the original implementation only covered the canonical 7-
        // char short form, which silently missed every revert authored
        // by such a repo.
        if (c.hash.length >= 7) {
            const upper = Math.min(c.hash.length - 1, MAX_PREFIX_INDEX_LENGTH);

            for (let prefixLength = 7; prefixLength <= upper; prefixLength += 1) {
                const prefix = c.hash.slice(0, prefixLength);

                if (byShaPrefix.has(prefix)) {
                    // Prefix already claimed — if it points at a
                    // different commit (not `c` itself, which can
                    // happen if `c.hash.length <= cap`), demote the
                    // slot to the ambiguity sentinel so neither
                    // commit silently wins the lookup.
                    const existing = byShaPrefix.get(prefix);

                    if (existing !== null && existing !== c) {
                        byShaPrefix.set(prefix, null);
                    }
                } else {
                    byShaPrefix.set(prefix, c);
                }
            }
        }
    }

    const findTarget = (revertCommit: AnnotatedCommit, walked: AnnotatedCommit[]): AnnotatedCommit | undefined => {
        // 1. SHA trailer wins when present.
        if (revertCommit.revertTargetSha) {
            // F17: the trailer SHA may be uppercase (REVERT_TRAILER_RE
            // is /i); git emits lowercase hashes so normalise here
            // before looking up the index or scanning chronologically.
            const ref = revertCommit.revertTargetSha.toLowerCase();
            const indexed = byShaPrefix.get(ref);
            // `null` = ambiguity sentinel (two commits share this
            // short prefix) → ignore the index hit and fall through to
            // the linear scan, which lets the caller see *all*
            // candidates and pick deterministically.
            let target: AnnotatedCommit | undefined = indexed ?? undefined;

            if (!target) {
                // Either no index hit, a prefix longer than the index
                // cap, OR the ambiguity sentinel forced fallthrough.
                // Fall back to a linear scan — O(n) but n is the
                // commit window, which is bounded by the release
                // window.
                target = chronological.find((c) => c.hash.startsWith(ref));
            }

            if (target && target !== revertCommit) {
                return target;
            }
        }

        // 2. Exact subject match against an EARLIER commit in the
        //    chronological walk. We scan walked-so-far in reverse so
        //    the closest match wins (matters when the same subject is
        //    reused, e.g. "feat: retry").
        if (revertCommit.revertSubject) {
            for (let i = walked.length - 1; i >= 0; i -= 1) {
                const candidate = walked[i]!;

                if (candidate.subject === revertCommit.revertSubject) {
                    return candidate;
                }
            }
        }

        return undefined;
    };

    // Walk the revert chain back to the underlying non-revert commit. A
    // revert of a revert ultimately toggles the original feat/fix — at
    // depth 4 (revert of revert of revert) the toggle fires again, so
    // the original ends up cancelled-active-cancelled-active across the
    // chain. We walk via the `cancelledBy` link the previous revert set
    // so a stable target identity falls out naturally.
    //
    // Returns `undefined` when the walk hits the depth cap — a
    // malformed chain (target pointing at itself, etc.) shouldn't
    // silently corrupt the mid-chain commit's state. The caller is
    // expected to skip the cancellation toggle when this happens (and
    // a warning is pushed via the `warnings` array so the operator
    // notices).
    const CHAIN_DEPTH_CAP = 64;
    const resolveOriginal = (revertTarget: AnnotatedCommit): AnnotatedCommit | undefined => {
        let current = revertTarget;

        for (let hop = 0; hop < CHAIN_DEPTH_CAP; hop += 1) {
            if (!current.revert) {
                return current;
            }

            // A revert's own `cancelledBy` was set to the SHA of the
            // commit IT cancelled when the revert was first processed.
            // Walk it back one step to find the underlying commit.
            const nextSha = current.cancelledBy;
            let next: AnnotatedCommit | undefined;

            if (nextSha) {
                const direct = byShaPrefix.get(nextSha);

                // `null` = ambiguity sentinel → ignore the index hit
                // (it's not safe to pick one over the other) and try
                // the 7-char fallback, which may or may not be
                // ambiguous itself.
                next = direct ?? undefined;

                if (!next) {
                    const short = byShaPrefix.get(nextSha.slice(0, 7));

                    next = short ?? undefined;
                }
            }

            if (!next || next === current) {
                return current;
            }

            current = next;
        }

        // Depth cap exhausted — the chain is malformed (loop, runaway
        // length, etc.). Signal failure so the caller can skip the
        // cancellation toggle that would otherwise mutate a mid-chain
        // revert.
        return undefined;
    };

    // Warnings buffer — collected here so both the chain-cap path
    // (F17) and the no-type-ratio check (F19) can push into the same
    // sink and the caller receives a single observability stream.
    const warnings: string[] = [];

    const walked: AnnotatedCommit[] = [];

    for (const commit of chronological) {
        if (commit.revert) {
            const target = findTarget(commit, walked);

            if (target) {
                // Released targets are a no-op — we can't unrelease.
                // The revert itself becomes a normal commit (it has a
                // legitimate fix to land + ship).
                if (releasedShas.has(target.hash)) {
                    walked.push(commit);

                    continue;
                }

                // Resolve to the underlying non-revert commit so a 4-
                // (or deeper) revert chain toggles the original
                // correctly. For a plain `revert(feat)` this is the
                // feat itself; for `revert(revert(feat))` it's the
                // feat (so we re-activate it); for
                // `revert(revert(revert(feat)))` it's the feat again
                // (so we cancel it back). The toggle is just "flip
                // whatever state the underlying commit is in".
                const original = resolveOriginal(target);

                if (original === undefined) {
                    // Chain blew the depth cap (malformed loop or
                    // pathological length). Skip the cancellation
                    // toggle so we don't mutate a mid-chain revert,
                    // surface a warning, and treat the revert itself
                    // as a normal commit.
                    warnings.push(
                        `Revert chain at ${commit.hash} exceeded depth limit (${CHAIN_DEPTH_CAP}) — skipping cancellation`,
                    );
                    walked.push(commit);

                    continue;
                }

                if (releasedShas.has(original.hash)) {
                    // Released ancestor — same rule as for `target`: we
                    // can't unrelease, and the revert is a real fix on
                    // its own. Leave the revert active and untouched.
                    walked.push(commit);

                    continue;
                }

                original.cancelled = !original.cancelled;
                original.cancelledBy = original.cancelled ? commit.hash : undefined;

                // The revert itself never contributes to the changelog —
                // its only purpose is to flip the underlying commit's
                // state. Always cancelled. `cancelledBy` records the
                // intermediate target (the commit this revert directly
                // references) so the chain remains walkable for the
                // next revert in the sequence.
                commit.cancelled = true;
                commit.cancelledBy = target.hash;
            }
            // Unresolved reverts (target wasn't found in the walked
            // range) stay active — the user did intend to land
            // something, and silently dropping the commit would be
            // worse than letting a `Revert "…"` line through the
            // changelog.
        }

        walked.push(commit);
    }

    // F19: count commits with no recognised conventional-commits type
    // (including reverts whose target is undetectable upstream). When
    // the no-type ratio exceeds 50% of the active (non-cancelled)
    // commits, push a single warning so the operator notices their
    // team is shipping commits with no convention. Reverts and merge
    // commits are both excluded — reverts inherit `type: undefined`
    // from the parser even when they cancel a perfectly-conventional
    // commit, and merge commits (`Merge pull request …`, `Merge
    // branch …`, `Merge remote-tracking branch …`, `Merge tag …`)
    // would otherwise inflate the no-type count on merge-heavy
    // branches and trip a spurious warning.
    const eligible = annotated.filter((c) => !c.cancelled && !c.revert && !c.subject?.startsWith("Merge "));
    const noType = eligible.filter((c) => !c.parsed.type);

    if (eligible.length > 0 && noType.length / eligible.length > 0.5) {
        const label = range ?? "<from>..HEAD";

        warnings.push(
            `${noType.length}/${eligible.length} commits in ${label} have no conventional-commits prefix. Consider enabling commit-message linting.`,
        );
    }

    return { commits: annotated, warnings };
};
