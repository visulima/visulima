/**
 * Revert detection + cancellation tests for `vis release generate`
 * (release-please #296 parity).
 *
 * Verifies `annotateAndResolveReverts` against the four shapes called
 * out in the task brief: subject-match revert, sha-body-match revert,
 * double revert, and a revert pointing at a SHA outside the current
 * commit window (treated as stale → no-op).
 */

import { describe, expect, it } from "vitest";

import type { CommitRecord } from "../../../src/release/core/generate/conventional-commits";
import {
    annotateAndResolveReverts,
    detectRevert,
    parseCommit,
} from "../../../src/release/core/generate/conventional-commits";

const mk = (hash: string, subject: string, body = "", files: string[] = []): CommitRecord => {
    return { body, files, hash, subject };
};

describe(detectRevert, () => {
    it("flags conventional `revert: <subject>` headers", () => {
        expect.hasAssertions();

        const parsed = parseCommit("revert: feat(api): add retry", "");
        const result = detectRevert("revert: feat(api): add retry", "", parsed);

        expect(result.isRevert).toBe(true);
        expect(result.targetSubject).toBe("feat(api): add retry");
    });

    it("flags default git `Revert \"<subject>\"` headers", () => {
        expect.hasAssertions();

        const parsed = parseCommit("Revert \"feat(api): add retry\"", "");
        const result = detectRevert("Revert \"feat(api): add retry\"", "", parsed);

        expect(result.isRevert).toBe(true);
        expect(result.targetSubject).toBe("feat(api): add retry");
    });

    it("extracts the SHA trailer from the body when present", () => {
        expect.hasAssertions();

        const parsed = parseCommit("Revert \"feat: foo\"", "This reverts commit abc1234.");
        const result = detectRevert("Revert \"feat: foo\"", "This reverts commit abc1234.", parsed);

        expect(result.targetSha).toBe("abc1234");
    });

    it("returns isRevert=false for a normal feat commit", () => {
        expect.hasAssertions();

        const parsed = parseCommit("feat: ship retry", "");
        const result = detectRevert("feat: ship retry", "", parsed);

        expect(result.isRevert).toBe(false);
    });
});

describe(annotateAndResolveReverts, () => {
    // The function used to return `AnnotatedCommit[]` directly; F19
    // expanded the return shape to `{ commits, warnings }` so the
    // caller can surface cross-cutting observability findings. Re-
    // assert the shape to lock the contract down.
    it("returns { commits, warnings } and the commits array carries the annotated records", () => {
        expect.hasAssertions();

        const result = annotateAndResolveReverts([mk("a1", "feat: x")]);

        expect(Array.isArray(result.commits)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
        expect(result.commits[0]?.parsed.type).toBe("feat");
    });

    it("cancels the original commit when matched by subject", () => {
        // git log lists newest first. Order:
        //   c2 (Revert "feat: retry")   ← newest
        //   c1 (feat: retry)            ← older
        expect.hasAssertions();

        const commits = [
            mk("c2", "Revert \"feat: retry\""),
            mk("c1", "feat: retry"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const original = annotated.find((c) => c.hash === "c1")!;
        const revert = annotated.find((c) => c.hash === "c2")!;

        expect(original.cancelled).toBe(true);
        expect(original.cancelledBy).toBe("c2");
        expect(revert.cancelled).toBe(true); // the revert itself drops out
    });

    it("cancels via the `This reverts commit <sha>` body trailer", () => {
        expect.hasAssertions();

        const commits = [
            mk("def4567", "revert: something different", "Bla bla\n\nThis reverts commit abc1234."),
            mk("abc1234", "feat(foo): land thing"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const original = annotated.find((c) => c.hash === "abc1234")!;

        expect(original.cancelled).toBe(true);
        expect(original.cancelledBy).toBe("def4567");
    });

    it("re-activates the original on a double revert (revert of revert)", () => {
        // git log order — newest first:
        //   c3 Revert "Revert "feat: retry""   ← newest (re-applies)
        //   c2 Revert "feat: retry"            ← cancels
        //   c1 feat: retry
        expect.hasAssertions();

        const commits = [
            // git wraps the reverted subject in quotes WITHOUT escaping inner
            // quotes, so a revert-of-revert reads: Revert "Revert "feat: retry""
            mk("c3", "Revert \"Revert \"feat: retry\"\""),
            mk("c2", "Revert \"feat: retry\""),
            mk("c1", "feat: retry"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const c1 = annotated.find((c) => c.hash === "c1")!;
        const c2 = annotated.find((c) => c.hash === "c2")!;
        const c3 = annotated.find((c) => c.hash === "c3")!;

        // The original is re-active …
        expect(c1.cancelled).toBe(false);
        // … the first revert was cancelled by the second revert …
        expect(c2.cancelled).toBe(true);
        // … and the second revert itself contributes nothing (it was
        // only there to neutralise the first revert).
        expect(c3.cancelled).toBe(true);
    });

    // F16: revert chain depth = 4 — `revert(revert(revert(feat)))`.
    // Chosen semantics (documented in conventional-commits.ts):
    //   c1 feat:           starts active
    //   c2 revert(c1):     cancels c1            → c1 cancelled, c2 cancelled
    //   c3 revert(c2):     un-cancels c1         → c1 active, c2 cancelled, c3 cancelled
    //   c4 revert(c3):     re-cancels c1         → c1 cancelled, c2/c3/c4 cancelled
    // i.e. each revert flips the underlying non-revert commit's state.
    // Reverts themselves never contribute to the changelog — only the
    // toggle on the original survives.
    //
    // The test uses SHA trailers (`This reverts commit <sha>`) so the
    // target-lookup is unambiguous regardless of nested-quote escaping
    // (avoids the subject-string escaping pitfalls that bite when
    // double-revert subjects encode each other).
    it("toggles the original across a 4-deep revert chain (revert of revert of revert)", () => {
        expect.hasAssertions();

        const commits = [
            mk("c4", "Revert \"feat: retry\"", "Layer 4\n\nThis reverts commit c3."),
            mk("c3", "Revert \"feat: retry\"", "Layer 3\n\nThis reverts commit c2."),
            mk("c2", "Revert \"feat: retry\"", "Layer 2\n\nThis reverts commit c1."),
            mk("c1", "feat: retry"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const c1 = annotated.find((c) => c.hash === "c1")!;
        const c2 = annotated.find((c) => c.hash === "c2")!;
        const c3 = annotated.find((c) => c.hash === "c3")!;
        const c4 = annotated.find((c) => c.hash === "c4")!;

        // c1 ended cancelled (even-depth chain cancels the original).
        expect(c1.cancelled).toBe(true);
        // Every revert in the chain is non-contributing.
        expect(c2.cancelled).toBe(true);
        expect(c3.cancelled).toBe(true);
        expect(c4.cancelled).toBe(true);
        // Final cancellation attributed to c4 (most recent toggle).
        expect(c1.cancelledBy).toBe("c4");
    });

    // F17: large repos with `core.abbrev = 11` (or higher) write 11-
    // and 12-char SHA refs into the `This reverts commit …` trailer.
    // The prefix index previously only covered the canonical 7-char
    // short form so the longer abbreviations silently missed.
    it("matches an 11-char SHA abbrev from the `This reverts commit` trailer", () => {
        // 40-char hashes are what git emits in `git log %H`. The body
        // trailer carries an 11-char abbrev (mimicking a repo with
        // core.abbrev=11).
        expect.hasAssertions();

        const fullSha = "abc1234567890123456789012345678901234567";
        const eleven = fullSha.slice(0, 11);
        const commits = [
            mk("def4567890abcdef1234567890abcdef12345678", "Revert \"feat: x\"", `Drop the thing\n\nThis reverts commit ${eleven}.`),
            mk(fullSha, "feat: x"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const original = annotated.find((c) => c.hash === fullSha)!;

        expect(original.cancelled).toBe(true);
        expect(original.cancelledBy).toBe("def4567890abcdef1234567890abcdef12345678");
    });

    // F17: uppercase SHA in the trailer (REVERT_TRAILER_RE is /i so
    // it captures uppercase hex). Git emits lowercase hashes, so the
    // captured trailer must be normalised at the parser site;
    // otherwise the case-sensitive `startsWith` linear fallback would
    // silently miss the target.
    it("matches when the `This reverts commit` trailer SHA is uppercase", () => {
        expect.hasAssertions();

        const commits = [
            mk("def4567", "Revert \"feat: y\"", "This reverts commit ABC1234."),
            mk("abc1234567890123456789012345678901234567", "feat: y"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const original = annotated.find((c) => c.hash === "abc1234567890123456789012345678901234567")!;

        expect(original.cancelled).toBe(true);
        expect(original.cancelledBy).toBe("def4567");
    });

    // F17: prefix-collision regression — when two commits share the
    // same 7-char prefix, the index must NOT silently hand back the
    // first one (chronologically earliest). The ambiguity sentinel
    // forces the lookup to fall through to the linear scan, which
    // then picks the deterministic match. Here both commits share the
    // prefix `abc1234`; a revert references the LATER commit by its
    // full SHA → should resolve to the later commit, not the earlier
    // one that claimed the short slot first.
    it("does not mis-resolve when two commits share a 7-char SHA prefix", () => {
        expect.hasAssertions();

        const earlySha = "abc1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const lateSha = "abc1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        // Newest first (git log order):
        //   revert → references `lateSha` (full 40 chars)
        //   feat   → lateSha
        //   feat   → earlySha
        const commits = [
            mk("def4567", "Revert \"feat: late\"", `This reverts commit ${lateSha}.`),
            mk(lateSha, "feat: late"),
            mk(earlySha, "feat: early"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits);
        const early = annotated.find((c) => c.hash === earlySha)!;
        const late = annotated.find((c) => c.hash === lateSha)!;

        // Full-hash lookup is unambiguous → only the LATE commit gets
        // cancelled. The EARLY commit must remain active.
        expect(late.cancelled).toBe(true);
        expect(late.cancelledBy).toBe("def4567");
        expect(early.cancelled).toBe(false);
    });

    it("treats a revert of an already-released commit as a no-op", () => {
        expect.hasAssertions();

        const commits = [
            mk("c2", "Revert \"feat: shipped already\""),
        ];

        // c1 is referenced by the revert via subject, but it is not in
        // the commit window. Instead we simulate the "already-released"
        // case by adding c1 to the released set; the function should
        // leave the revert active (it has its own ship-worthy fix).
        const { commits: annotated } = annotateAndResolveReverts(commits, new Set(["c1"]));
        const revert = annotated.find((c) => c.hash === "c2")!;

        // Revert can't find a target (c1 not in walk window) so stays
        // active. The released-set guard kicks in only when the SHA IS
        // walked but is known-shipped.
        expect(revert.cancelled).toBe(false);
    });

    it("respects releasedShas: when revert target IS in the window but already shipped, keep the revert active", () => {
        expect.hasAssertions();

        const commits = [
            mk("c2", "Revert \"feat: shipped already\"", "This reverts commit shipped1."),
            mk("shipped1", "feat: shipped already"),
        ];

        const { commits: annotated } = annotateAndResolveReverts(commits, new Set(["shipped1"]));
        const original = annotated.find((c) => c.hash === "shipped1")!;
        const revert = annotated.find((c) => c.hash === "c2")!;

        // Cannot "unrelease" — original stays active (it was shipped),
        // and the revert ALSO stays active (it has a legitimate fix to
        // ship via a new patch release).
        expect(original.cancelled).toBe(false);
        expect(revert.cancelled).toBe(false);
    });
});

// ── F19: no-type-ratio warning ───────────────────────────────────────

describe("annotateAndResolveReverts: F19 no-type-ratio warning", () => {
    it("emits a warning when > 50% of active commits have no conventional-commits prefix", () => {
        expect.hasAssertions();

        const commits = [
            mk("h1", "Just a thing"),
            mk("h2", "another untyped commit"),
            mk("h3", "more untyped stuff"),
            mk("h4", "feat: typed once"),
        ];

        const { warnings } = annotateAndResolveReverts(commits, undefined, "main..HEAD");

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("3/4");
        expect(warnings[0]).toContain("main..HEAD");
        expect(warnings[0]).toContain("conventional-commits");
    });

    it("does NOT emit the warning when the no-type ratio is at or below 50%", () => {
        expect.hasAssertions();

        const commits = [
            mk("h1", "feat: typed one"),
            mk("h2", "fix: typed two"),
            mk("h3", "no type here"),
            mk("h4", "still no type"),
        ];

        const { warnings } = annotateAndResolveReverts(commits);

        // 2/4 = 0.5 — not strictly greater than 0.5, so no warning.
        expect(warnings).toHaveLength(0);
    });

    it("excludes reverts and cancelled commits from the no-type ratio (reverts always parse as type=undefined)", () => {
        // Pure revert pair: revert resolves cleanly so c1 becomes
        // cancelled. The remaining "active" set is empty → ratio is
        // 0/0 → no warning.
        expect.hasAssertions();

        const commits = [
            mk("c2", "Revert \"feat: x\"", "This reverts commit c1."),
            mk("c1", "feat: x"),
        ];

        const { warnings } = annotateAndResolveReverts(commits);

        expect(warnings).toHaveLength(0);
    });

    it("uses a sensible default range label when none is passed", () => {
        expect.hasAssertions();

        const commits = [mk("h1", "no type here either")];
        const { warnings } = annotateAndResolveReverts(commits);

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("<from>..HEAD");
    });

    // F19: merge commits parse with `type: undefined`. A merge-heavy
    // branch would otherwise blow the 50% no-type ratio and trip a
    // spurious warning. Filter all four `Merge …` shapes that git
    // emits by default: `Merge pull request`, `Merge branch`,
    // `Merge remote-tracking branch`, `Merge tag`.
    it("excludes merge commits from the no-type ratio", () => {
        expect.hasAssertions();

        const commits = [
            mk("m1", "Merge pull request #123 from foo/bar"),
            mk("m2", "Merge branch 'main' into feature"),
            mk("m3", "Merge remote-tracking branch 'origin/main'"),
            mk("m4", "Merge tag 'v1.2.3'"),
            mk("h1", "feat: typed once"),
        ];

        const { warnings } = annotateAndResolveReverts(commits);

        // The 4 merges are excluded; only the 1 feat counts → 0/1
        // no-type ratio → no warning. Without the merge filter we'd
        // see 4/5 = 80% and trip a spurious warning.
        expect(warnings).toHaveLength(0);
    });
});

// ── F17: chain-cap warning ───────────────────────────────────────────

describe("annotateAndResolveReverts: F17 revert-chain depth cap", () => {
    it("surfaces a warning and skips cancellation when a revert chain self-loops past the depth cap", () => {
        // A pathological self-referential chain: every commit is a
        // revert whose body points back at the same SHA (itself),
        // forming a loop the resolver would otherwise spin on. The
        // depth cap (64) prevents the spin; the new behaviour
        // surfaces a warning AND skips the cancellation toggle so a
        // mid-chain revert isn't mutated.
        //
        // We need a "real" chain where `cancelledBy` keeps pointing
        // at another revert. The simplest reproducer: a long chain of
        // reverts where each layer's trailer references the next
        // older layer, and the OLDEST layer's trailer references
        // ITSELF — that closes the loop the resolver would otherwise
        // walk forever.
        expect.hasAssertions();

        const layers = 70;
        const commits: CommitRecord[] = [];

        for (let index = 0; index < layers; index += 1) {
            // Hex-only SHAs — the `This reverts commit <sha>` trailer regex
            // matches hex (git emits lowercase hex), so a leading non-hex
            // char like `r` would make the chain unresolvable.
            const sha = `${index.toString().padStart(2, "0")}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
            // Each layer reverts the next (older) one; the last
            // layer self-references to form the loop.
            const target = index === layers - 1 ? sha : `${(index + 1).toString().padStart(2, "0")}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;

            commits.push(mk(sha, "Revert \"feat: chained\"", `This reverts commit ${target}.`));
        }

        const { warnings } = annotateAndResolveReverts(commits);

        // At least one chain-cap warning should be emitted naming
        // the depth limit. We don't pin the exact count — the
        // resolver may hit the cap at multiple entry points.
        expect(warnings.some((w) => w.includes("exceeded depth limit (64)"))).toBe(true);
    });
});

// ── Gitmoji prefix strip (release-please #2385) ─────────────────────

describe("parseCommit: gitmoji / shortcode prefix strip", () => {
    it("strips a leading Unicode emoji before parsing", () => {
        expect.hasAssertions();

        const parsed = parseCommit("🚀 feat: add tab completion", "");

        expect(parsed.type).toBe("feat");
    });

    it("strips a leading :shortcode: prefix before parsing", () => {
        expect.hasAssertions();

        const parsed = parseCommit(":rocket: feat(cli): add tab completion", "");

        expect(parsed.type).toBe("feat");
        expect(parsed.scope).toBe("cli");
    });

    it("parses a bare conventional commit unchanged when no emoji prefix is present", () => {
        expect.hasAssertions();

        const parsed = parseCommit("feat(api): add retry logic", "");

        expect(parsed.type).toBe("feat");
        expect(parsed.scope).toBe("api");
    });
});
