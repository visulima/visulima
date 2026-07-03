/**
 * Single-pass token interpolation for the per-package `releaseNoteTemplate`
 * header / footer (release-please #1274 parity).
 *
 * Wired into `orchestrator.ts#applyReleaseNoteTemplate`, which used to
 * run `replaceAll` per token sequentially. That was safe in practice —
 * semver doesn't contain `{previousVersion}` as a literal substring —
 * but the ordering was a latent footgun: if a future token value ever
 * contained another token literal, the second `replaceAll` would
 * interpolate it. F20 hardens the interpolation with a single-pass
 * regex that resolves each match against the token table independently
 * and ignores token-like substrings inside already-substituted values.
 */

import { escapeMarkdown } from "./security";

/** Tokens recognised inside `releaseNoteTemplate.header` / `.footer`. */
export type ReleaseNoteTemplateToken = "contributors" | "date" | "name" | "previousVersion" | "repo" | "version";

/** Operator-supplied template values. Missing tokens render as the empty string. */
export type ReleaseNoteTemplateTokens = Partial<Record<ReleaseNoteTemplateToken, string>>;

/**
 * Pre-compiled alternation regex covering every supported token.
 *
 * Single-pass (`replace` with a callback) so each match resolves
 * against the token table independently — a token's substituted value
 * can never be re-interpolated by a later pass. Unknown braced sequences
 * (e.g. `{previousVer` with no closing brace, or `{unknownToken}`) are
 * left verbatim.
 */
const TOKEN_RE = /\{(name|version|previousVersion|date|repo|contributors)\}/g;

/**
 * Substitute supported `{token}` placeholders in `template` with the
 * matching values from `tokens`. Tokens missing from the map render as
 * the empty string. Unknown / malformed braced sequences are left
 * untouched.
 *
 * Pure function. Safe to call with `template === ""` (returns `""`).
 * @param template Raw template string with `{token}` placeholders.
 * @param tokens Lookup table; missing keys render empty.
 * @returns The interpolated string.
 */
export const expandReleaseNoteTemplate = (template: string, tokens: ReleaseNoteTemplateTokens): string =>
    template.replaceAll(TOKEN_RE, (_, key: ReleaseNoteTemplateToken) => tokens[key] ?? "");

/**
 * Minimal change-file shape needed to extract a contributor handle.
 * Mirrors `ChangeFile["meta"]` from `types.ts` without importing the
 * full type so this helper stays pure / dependency-free.
 */
export interface ContributorSourceChangeFile {
    meta?: {
        author?: string;
    };
}

/** Options accepted by `collectContributors`. */
export interface CollectContributorsOptions {
    /**
     * Handles (case-insensitive, with or without leading `@`) to suppress.
     * Mirrors the github-formatter `internalAuthors` field so the rendered
     * `{contributors}` token and `CHANGELOG.md` agree on which bots to
     * hide. Empty / undefined → no filtering.
     */
    internalAuthors?: ReadonlyArray<string>;
}

/**
 * Collect the formatted `{contributors}` value for a wave of change
 * files (release-please #292 parity).
 *
 * Reads each change file's `author:` frontmatter line (already parsed
 * upstream by `change-file.ts`). Supports comma-separated handles on a
 * single line (`author: \@alice, \@bob`). De-duplicates case-insensitively
 * by the rendered handle and preserves first-seen casing. Empty input →
 * empty string (consistent with how other missing-data tokens render).
 *
 * **Block-only token.** The return value is a multi-line bullet list
 * with no leading or trailing newline. Inline use like
 * `"Thanks {contributors}!"` produces broken markdown — keep the token
 * on its own line, typically under a heading.
 *
 * **Markdown-escaped.** Author handles are run through `escapeMarkdown`
 * before being embedded so a malicious or accidental frontmatter value
 * (e.g. `author: alice](evil)`) can't break out of the bullet syntax or
 * inject inline HTML into the rendered release notes.
 *
 * **Bot filtering.** Pass `internalAuthors` to suppress handles that
 * the github changelog formatter is configured to hide; without it the
 * release-notes `{contributors}` block and the CHANGELOG.md will
 * disagree about who shipped the wave.
 *
 * TODO (follow-up): when no change file carries an `author:` field,
 * fall back to `git log &lt;prev-tag>..HEAD -- &lt;package-path>` to extract
 * commit authors. Punted from this pass — the orchestrator-side wave
 * data already has the tag range available but plumbing it through
 * without bloating the helper's surface needs its own iteration.
 * @param changeFiles Change files contributing to this release.
 * @param options Optional internal-author filter.
 * @returns A bullet list (`- \@alice\n- \@bob`) or `""` if none.
 */
export const collectContributors = (changeFiles: ReadonlyArray<ContributorSourceChangeFile>, options: CollectContributorsOptions = {}): string => {
    const suppressed = new Set<string>();

    for (const raw of options.internalAuthors ?? []) {
        const normalized = raw.trim().toLowerCase().replace(/^@/, "");

        if (normalized.length > 0) {
            suppressed.add(normalized);
        }
    }

    const seen = new Set<string>();
    const handles: string[] = [];

    for (const file of changeFiles) {
        const raw = file.meta?.author;

        if (!raw) {
            continue;
        }

        // Split on comma so a single `author: \@alice, \@bob` line credits
        // both contributors. Whitespace-only segments fall out via the
        // `trim` / empty check below.
        for (const piece of raw.split(",")) {
            const handle = piece.trim();

            if (!handle) {
                continue;
            }

            // Reject `@` alone (operator typed the prefix but left the
            // handle blank). Strip the prefix for the dedup + suppression
            // lookup so `\@alice` and `alice` collapse.
            const stripped = handle.replace(/^@/, "");

            if (stripped.length === 0) {
                continue;
            }

            const key = stripped.toLowerCase();

            if (seen.has(key) || suppressed.has(key)) {
                continue;
            }

            seen.add(key);
            handles.push(escapeMarkdown(handle));
        }
    }

    if (handles.length === 0) {
        return "";
    }

    return handles.map((h) => `- ${h}`).join("\n");
};
