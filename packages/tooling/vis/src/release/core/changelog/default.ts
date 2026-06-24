/**
 * Default changelog formatter — plain Markdown, no GitHub-specific links.
 *
 * Header: `## &lt;version>\n&lt;sub>YYYY-MM-DD&lt;/sub>`.
 * Body: bulleted list of change-file bodies, with dependency-bump and
 * cascade entries synthesized when the release wasn't directly authored.
 *
 * Author credits: when the change file body contains an `author: \@user`
 * inline meta line, that author is appended as ` (@user)` to each entry
 * produced from that file. Set this on a workspace via
 * `release.changelog: ["default", { authorCredit: true }]` — defaults
 * to off so legacy changelogs don't gain unsolicited credit lines.
 */

import type { ChangelogContext, ChangelogFormatter } from "./api";

/**
 * Section heading config — release-please parity. Each rule maps a
 * commit-conventional `type` (extracted from change-file body lines
 * like `feat: …` / `fix: …`) to a section heading. Use `hidden: true`
 * to drop entries of that type entirely (e.g. `chore:` noise).
 *
 * Default mapping (when `sections` is omitted) preserves the legacy
 * flat-list output.
 */
export interface ChangelogSection {
    /**
     * Drop entries of this type entirely. Useful for `chore`, `style`,
     * `refactor` — the "internal" changes consumers don't care about.
     */
    hidden?: boolean;
    /** Markdown heading (without leading `###`). */
    section: string;
    /** Conventional-commit type — `feat`, `fix`, `perf`, `chore`, … */
    type: string;
}

export interface DefaultFormatterOptions {
    /**
     * Append `(@username)` to each changelog entry produced from a
     * change file with an `author: \@user` inline-meta line. Default off.
     */
    authorCredit?: boolean;

    /**
     * Group entries under section headings inferred from
     * conventional-commit type prefixes. When omitted, the formatter
     * emits a flat list (legacy behaviour). When `sections: []`,
     * grouping uses the release-please default mapping.
     */
    sections?: ChangelogSection[];
}

const DEFAULT_SECTIONS: ChangelogSection[] = [
    { section: "Breaking Changes", type: "breaking" },
    { section: "Features", type: "feat" },
    { section: "Bug Fixes", type: "fix" },
    { section: "Performance Improvements", type: "perf" },
    { section: "Reverts", type: "revert" },
    { section: "Documentation", type: "docs" },
    { hidden: true, section: "Styles", type: "style" },
    { hidden: true, section: "Code Refactoring", type: "refactor" },
    { hidden: true, section: "Tests", type: "test" },
    { hidden: true, section: "Build System", type: "build" },
    { hidden: true, section: "Continuous Integration", type: "ci" },
    { hidden: true, section: "Miscellaneous Chores", type: "chore" },
];

const COMMIT_TYPE_REGEX = /^(?<type>[a-z]+)(?:\([^)]+\))?!?:\s+/;

/**
 * Optional gitmoji / `:shortcode:` prefix preceding the conventional
 * commit type (release-please #2385 parity).
 *
 * Some teams use ":rocket: feat: add tab completion" or "🚀 feat: …".
 * Strip a leading single emoji codepoint OR a `:word:` shortcode (plus
 * trailing whitespace) before applying COMMIT_TYPE_REGEX so the parser
 * doesn't bail on the leading non-ASCII glyph.
 */
const GITMOJI_PREFIX_REGEX = /^(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}]|:\w+:)\s+/u;

/**
 * Extract a conventional-commit type from a body line. Returns
 * `undefined` for lines that don't match the convention; the caller
 * is responsible for the "no type" bucket.
 *
 * `feat!:`/`fix!:`/etc. → `"breaking"` so type-level breaking
 * conventions get the `Breaking Changes` section without requiring
 * the operator to use a custom `breaking:` prefix.
 *
 * A leading gitmoji (Unicode emoji codepoint) or `:shortcode:` is
 * stripped before parsing (release-please #2385). Lines like
 * `:rocket: feat: add tab completion` and `🚀 feat: add tab completion`
 * both yield `"feat"`.
 */
const extractCommitType = (line: string): string | undefined => {
    // Strip a leading gitmoji / shortcode before applying the conventional-
    // commits regex. Keeps the rest of the parser unchanged.
    const stripped = line.replace(GITMOJI_PREFIX_REGEX, "");
    const match = COMMIT_TYPE_REGEX.exec(stripped);

    if (!match?.groups?.["type"]) {
        return undefined;
    }

    // Breaking-change shorthand: `feat!:` / `fix!:` / etc.
    if (stripped.includes("!:") && stripped.split("!:")[0]?.match(/^[a-z]+(?:\([^)]+\))?$/)) {
        return "breaking";
    }

    return match.groups["type"];
};

const formatAuthor = (author: string): string => `(${author.startsWith("@") ? author : `@${author}`})`;

const renderFlat = (lines: string[], entries: { line: string; suffix: string }[]): void => {
    for (const entry of entries) {
        const normalised = entry.line.startsWith("-") || entry.line.startsWith("*") ? entry.line : `- ${entry.line}`;

        lines.push(`${normalised}${entry.suffix}`);
    }
};

const renderSectioned = (lines: string[], entries: { line: string; suffix: string; type: string | undefined }[], sections: ChangelogSection[]): void => {
    // Bucket entries by type. Lines without a recognised type go to a
    // "Miscellaneous" catch-all rendered after every configured
    // section, unless that catch-all type is itself hidden.
    const byType = new Map<string, { line: string; suffix: string }[]>();

    for (const entry of entries) {
        const type = entry.type ?? "other";
        const bucket = byType.get(type) ?? [];

        bucket.push({ line: entry.line, suffix: entry.suffix });
        byType.set(type, bucket);
    }

    for (const rule of sections) {
        const bucket = byType.get(rule.type);

        if (rule.hidden) {
            // Hidden types are dropped entirely — remove the bucket so it
            // doesn't leak into the Miscellaneous catch-all rendered below.
            byType.delete(rule.type);

            continue;
        }

        if (!bucket || bucket.length === 0) {
            continue;
        }

        lines.push(`### ${rule.section}`);
        lines.push("");

        for (const entry of bucket) {
            const normalised = entry.line.startsWith("-") || entry.line.startsWith("*") ? entry.line : `- ${entry.line}`;

            lines.push(`${normalised}${entry.suffix}`);
        }

        lines.push("");

        byType.delete(rule.type);
    }

    // Leftover types not covered by `sections` → catch-all section.
    // Skip if `other` is configured + hidden.
    const otherHidden = sections.some((s) => s.type === "other" && s.hidden);

    if (!otherHidden && byType.size > 0) {
        lines.push("### Miscellaneous");
        lines.push("");

        for (const bucket of byType.values()) {
            for (const entry of bucket) {
                const normalised = entry.line.startsWith("-") || entry.line.startsWith("*") ? entry.line : `- ${entry.line}`;

                lines.push(`${normalised}${entry.suffix}`);
            }
        }
    }
};

export const createDefaultFormatter
    = (options: DefaultFormatterOptions = {}): ChangelogFormatter =>
        (context: ChangelogContext): string => {
            const { changeFiles, date, release, target } = context;
            const lines: string[] = [];

            if (target !== "github-release") {
                lines.push(`## ${release.newVersion}`);
                lines.push(`<sub>${date}</sub>`);
                lines.push("");
            }

            // Collect entries with their inferred conventional-commit type
            // so the renderer can decide flat-list vs sectioned output.
            const entries: { line: string; suffix: string; type: string | undefined }[] = [];

            for (const file of changeFiles) {
                const body = file.body.trim();

                if (!body) {
                    continue;
                }

                const author = options.authorCredit ? file.meta?.author : undefined;
                const suffix = author ? ` ${formatAuthor(author)}` : "";

                for (const rawLine of body.split(/\r?\n/)) {
                    const line = rawLine.trim();

                    if (!line) {
                        continue;
                    }

                    entries.push({ line, suffix, type: extractCommitType(line) });
                }
            }

            const sections = options.sections === undefined ? undefined : options.sections.length === 0 ? DEFAULT_SECTIONS : options.sections;

            if (sections) {
                renderSectioned(lines, entries, sections);
            } else {
                renderFlat(lines, entries);
            }

            if (release.isCascadeBump || release.isGroupBump) {
                for (const source of release.sources) {
                    const verb = release.isCascadeBump ? "Cascade from" : "Group bump with";

                    lines.push(`- ${verb} ${source.name}@${source.newVersion}`);
                }
            } else if (release.isDependencyBump && changeFiles.length === 0) {
                for (const source of release.sources) {
                // F13: catalog REMOVALs surface as `newVersion === ""`
                // (the release-plan stores `entry.newVersion ?? ""` for
                // the synthetic catalog source). Render as a removal
                // line so we don't emit a malformed trailing `@`.
                    if (source.newVersion === "") {
                        lines.push(`- Removed dependency ${source.name}`);
                    } else {
                        lines.push(`- Updated dependency ${source.name}@${source.newVersion}`);
                    }
                }
            }

            return lines
                .join("\n")
                .replaceAll(/\n{3,}/g, "\n\n")
                .trim();
        };

export const defaultFormatter: ChangelogFormatter = createDefaultFormatter();
