/**
 * Operator-edit preservation for the version-PR body (release-please #877).
 *
 * `vis release ci release` regenerates the version-PR body on every CI
 * tick. Without protection, any manual edits an operator makes inside
 * the PR description are silently overwritten on the next push.
 *
 * The fix: dual-marker blocks delimit operator-owned regions:
 *
 *   &lt;!-- vis:user-content -->
 *   …anything in here is preserved verbatim…
 *   &lt;!-- /vis:user-content -->
 *
 * `mergeProtectedContent` extracts every block from the existing body
 * and re-inserts it into the freshly-generated body. If the new body
 * already contains matching marker pairs (empty or otherwise), the
 * extracted blocks fill those slots in order; otherwise they're
 * appended at the end of the new body.
 *
 * Pure function — no fs / no git. The CI handler reads the existing PR
 * body via `gh pr view`, runs it through this merger, then posts the
 * result via `gh pr edit`.
 */

import { VisReleaseError } from "../errors";

const OPEN_MARKER = "<!-- vis:user-content -->";
const CLOSE_MARKER = "<!-- /vis:user-content -->";

/**
 * Greedy, non-overlapping match of `&lt;!-- vis:user-content -->...&lt;!-- /vis:user-content -->`.
 *
 * The `[\s\S]*?` middle is lazy so consecutive blocks don't collapse
 * into one huge capture. We capture the inner content (between the
 * markers) so the merger can re-emit each block verbatim, including
 * the leading / trailing whitespace the operator typed.
 */
const BLOCK_RE = /<!-- vis:user-content -->([\s\S]*?)<!-- \/vis:user-content -->/g;

/**
 * Detects a nested-marker abuse — an open marker followed by another
 * open marker before the corresponding close. The regex above is lazy,
 * so it would happily extract the INNER block and leave the OUTER open
 * marker dangling. That produces silent data loss, which is the exact
 * failure mode we're trying to prevent — so we hard-reject up front.
 */
// True nesting = a second opening marker appears BEFORE the first block's
// closing marker. The segment between the two opens must therefore contain no
// closing marker (negative lookahead) — otherwise `open … close … open …
// close` (legitimate *sequential* blocks) would be misread as nested and the
// merger would refuse a perfectly valid multi-block PR body.
const NESTED_RE = /<!-- vis:user-content -->(?:(?!<!-- \/vis:user-content -->)[\s\S])*?<!-- vis:user-content -->/;

const PROTECTED_BLOCK = (inner: string): string => `${OPEN_MARKER}${inner}${CLOSE_MARKER}`;

/**
 * Replace the empty marker pairs in `newBody` with the supplied content
 * blocks in order. A "matching empty marker" is `&lt;open>&lt;close>` with no
 * content between them (only the optional whitespace operators commonly
 * leave when they roughed in an empty placeholder).
 *
 * Returns the body with placeholders filled and the remaining blocks
 * that didn't have a slot to land in (caller appends those).
 */
const fillEmptyMarkers = (newBody: string, blocks: string[]): { body: string; remaining: string[] } => {
    const empties: { end: number; start: number }[] = [];
    const matcher = /<!-- vis:user-content -->\s*<!-- \/vis:user-content -->/g;

    let match = matcher.exec(newBody);

    while (match !== null) {
        empties.push({ end: match.index + match[0].length, start: match.index });
        match = matcher.exec(newBody);
    }

    if (empties.length === 0) {
        return { body: newBody, remaining: blocks };
    }

    let cursor = 0;
    const parts: string[] = [];
    const fillCount = Math.min(empties.length, blocks.length);

    for (let index = 0; index < fillCount; index += 1) {
        const placeholder = empties[index]!;
        const block = blocks[index]!;

        parts.push(newBody.slice(cursor, placeholder.start));
        parts.push(block);
        cursor = placeholder.end;
    }

    parts.push(newBody.slice(cursor));

    return { body: parts.join(""), remaining: blocks.slice(fillCount) };
};

/**
 * Merge any operator-edited protected blocks from `existingBody` into
 * `newBody`, returning the composed PR body that should be posted.
 *
 * Algorithm:
 *   1. If there's no existing body (PR is being created for the first
 *      time), return `newBody` unchanged.
 *   2. Reject nested markers up front — those are ambiguous and the
 *      lazy regex would silently lose data. The operator must collapse
 *      them manually.
 *   3. Extract every `&lt;!-- vis:user-content -->…&lt;!-- /vis:user-content -->`
 *      block from `existingBody` (greedy, lazy inner).
 *   4. Walk `newBody` for matching EMPTY marker pairs and fill them in
 *      order with the extracted blocks. Anything that doesn't have a
 *      slot is appended to the end of `newBody`.
 *   5. Return the composed body. Trailing whitespace is normalised to
 *      a single newline so PRs don't accumulate trailing blank lines on
 *      every CI tick.
 */
export const mergeProtectedContent = (existingBody: string | undefined, newBody: string): string => {
    if (existingBody === undefined || existingBody === "") {
        return newBody;
    }

    // F18: surface unbalanced open/close pairs up-front. The greedy
    // `BLOCK_RE` below only matches well-formed pairs, so an orphan
    // open marker (e.g. 3 opens, 2 closes) would silently drop the
    // partial edit. Count and refuse before any extraction runs.
    //
    // Strip markdown fenced code blocks (``` and ~~~) before counting
    // so a PR body that documents the marker syntax inside a code
    // fence doesn't trigger a false-positive unbalanced throw. The
    // real extraction below operates on the raw body; this stripped
    // copy is used ONLY for the balance heuristic.
    const stripped = existingBody.replaceAll(/```[\s\S]*?```/g, "").replaceAll(/~~~[\s\S]*?~~~/g, "");
    const openCount = (stripped.match(/<!-- vis:user-content -->/g) ?? []).length;
    const closeCount = (stripped.match(/<!-- \/vis:user-content -->/g) ?? []).length;

    if (openCount !== closeCount) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: "Fix the marker pairs in the PR body and re-run.",
            message: `PR body has unbalanced <!-- vis:user-content --> markers (${openCount} opens, ${closeCount} closes). Refusing to merge to prevent silent edit loss.`,
        });
    }

    // Run the nested-marker check against the fence-stripped copy too, so a
    // PR body that documents the marker syntax inside a code fence doesn't
    // trip the nesting guard (mirrors the balance heuristic above).
    if (NESTED_RE.test(stripped)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: "Flatten the nesting in the PR body and re-run.",
            message: "Nested <!-- vis:user-content --> markers are not allowed in PR body. The merger refuses to operate to prevent silent edit loss.",
        });
    }

    // Collect every operator-edited block, preserving the inner
    // whitespace verbatim. `globalThis.Array.from` so the matcher
    // doesn't get re-used by a re-entrant call.
    const blocks: string[] = [];

    for (const match of existingBody.matchAll(BLOCK_RE)) {
        const inner = match[1] ?? "";

        // Skip blocks the operator never actually populated. An EMPTY
        // pair (`<open><close>` with only whitespace) carries no
        // operator content; preserving it adds noise without saving
        // edits. The fill-step below will recreate an empty pair if
        // newBody had one in the same position.
        if (inner.trim() === "") {
            continue;
        }

        blocks.push(PROTECTED_BLOCK(inner));
    }

    if (blocks.length === 0) {
        return newBody;
    }

    // Try to fill any matching empty marker pairs in the new body
    // first; that lets templates pre-position the operator-content
    // slot at a deterministic location. Anything left over gets
    // appended at the end.
    const { body, remaining } = fillEmptyMarkers(newBody, blocks);

    if (remaining.length === 0) {
        return body;
    }

    const trimmedBody = body.replace(/\s+$/u, "");
    const tail = remaining.join("\n\n");

    return `${trimmedBody}\n\n${tail}\n`;
};
