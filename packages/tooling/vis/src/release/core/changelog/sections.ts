/**
 * Grouped-section rendering — the one renderer behind every built-in
 * formatter that buckets changelog entries by conventional-commit type.
 *
 * The shape is `conventional-changelog-conventionalcommits`'
 * `presetConfig.types`: an ordered `{ type, section, hidden? }` table drives
 * both which sections exist and what order they appear in. Formatters supply
 * their own table plus a handful of format decisions ({@link RenderGroupedOptions});
 * they do not re-implement the bucketing.
 *
 * The invariant this module exists to guarantee: **nothing is silently
 * dropped**. Every entry lands in exactly one bucket, and every bucket is
 * emitted — a type with no rule, and a line that does not parse as a
 * conventional header at all, both fall through to the catch-all section.
 * The only way to lose an entry is to hide its type explicitly.
 */

import type { ParsedConventionalHeader } from "./conventional-header";
import { hasBulletMarker, isBreakingChange, parseConventionalHeader, stripBulletMarker } from "./conventional-header";

/**
 * One `type → section` mapping. Same shape as
 * `conventional-changelog-conventionalcommits`' `presetConfig.types`, so a
 * config lifted straight out of a `.versionrc` / release-please config works
 * unchanged.
 */
export interface ConventionalTypeRule {
    /**
     * Drop entries of this type from the rendered output. Breaking changes
     * are still surfaced under the breaking section — hiding a type never
     * hides an incompatible change.
     */
    hidden?: boolean;
    /** Markdown heading text, rendered as `### &lt;section>`. */
    section: string;
    /** Conventional-commit type — `feat`, `fix`, `perf`, … Matched case-insensitively. */
    type: string;
}

/**
 * Bucket key for entries that no rule claims: a line that does not parse as a
 * conventional header, and a header whose type has no rule in the table.
 * A table may name it explicitly (`{ type: "other", … }`) to place the
 * catch-all section or to hide it.
 */
export const UNCATEGORIZED_TYPE = "other";

/** Heading used for breaking changes, matching this monorepo's existing history. */
export const DEFAULT_BREAKING_SECTION = "⚠ BREAKING CHANGES";

/** Heading used for the catch-all bucket when the table doesn't name one. */
export const DEFAULT_UNCATEGORIZED_SECTION = "Other Changes";

/**
 * Default `type → section` table.
 *
 * The first block is `conventional-changelog-conventionalcommits`' preset
 * verbatim (`feat`/`fix`/`perf`/`revert` visible; `docs`/`style`/`chore`/
 * `refactor`/`test`/`build`/`ci` hidden), so a package migrating off
 * semantic-release keeps the exact section set its history already uses.
 *
 * The second block covers the extra types this repo's commit convention adds
 * on top of the Angular set. They are hidden by default — they describe work
 * on the repo rather than a change a consumer of the published package can
 * observe — with one exception: `deps` is visible as `Dependencies`, because
 * `multi-semantic-release` already writes a visible `### Dependencies` section
 * and dropping it would lose the upgrade trail an adopter reads to answer
 * "which version of X did this release pull in?".
 *
 * `other` is the home for commits that do not parse as conventional; it is
 * visible so nothing is ever silently dropped. Hide it explicitly with
 * `{ type: "other", section: "…", hidden: true }` if you would rather lose them.
 */
export const DEFAULT_CONVENTIONAL_TYPES: ReadonlyArray<ConventionalTypeRule> = [
    { section: "Features", type: "feat" },
    { section: "Features", type: "feature" },
    { section: "Bug Fixes", type: "fix" },
    { section: "Performance Improvements", type: "perf" },
    { section: "Reverts", type: "revert" },
    { hidden: true, section: "Documentation", type: "docs" },
    { hidden: true, section: "Styles", type: "style" },
    { hidden: true, section: "Code Refactoring", type: "refactor" },
    { hidden: true, section: "Tests", type: "test" },
    { hidden: true, section: "Build System", type: "build" },
    { hidden: true, section: "Continuous Integration", type: "ci" },
    { hidden: true, section: "Miscellaneous Chores", type: "chore" },

    // visulima-specific types (see CLAUDE.md "Commit Convention").
    { section: "Dependencies", type: "deps" },
    { hidden: true, section: "Developer Experience", type: "dx" },
    { hidden: true, section: "Types", type: "types" },
    { hidden: true, section: "Work In Progress", type: "wip" },
    { hidden: true, section: "Releases", type: "release" },
    { hidden: true, section: "Workflow", type: "workflow" },

    { section: DEFAULT_UNCATEGORIZED_SECTION, type: UNCATEGORIZED_TYPE },
];

/** A single changelog line handed to the grouped renderer. */
export interface GroupableEntry {
    /** The authored line — with or without a leading bullet marker. */
    line: string;
    /** Appended verbatim after the rendered entry (PR / commit refs, author credit). */
    suffix?: string;
}

/**
 * How an entry's text is derived from its authored line.
 *
 *   - `"scope"`    — conventional-changelog rendering: drop the `type(scope):`
 *                    prefix and re-emit the scope as a bold `**scope:**`
 *                    lead-in. Lines no rule claims stay verbatim so their
 *                    prefix isn't lost.
 *   - `"verbatim"` — keep the authored line exactly as written, including any
 *                    leading list marker (what the `default` formatter emits).
 */
export type EntryStyle = "scope" | "verbatim";

export interface RenderGroupedOptions {
    /**
     * Heading listing every breaking change ahead of the type sections, so an
     * incompatible change stays visible even when its own type is hidden.
     * Pass `false` to fold breaking changes into their type section only.
     * Default: {@link DEFAULT_BREAKING_SECTION}.
     */
    breakingSection?: false | string;

    /**
     * Re-bucket entries whose header carries the `!` marker under this
     * pseudo-type instead of their own, so a table can give them a section of
     * their own (`{ section: "Breaking Changes", type: "breaking" }`). An
     * inline `BREAKING CHANGE` note does *not* re-type an entry — only the
     * header marker does. Off by default.
     */
    breakingType?: string;

    /** List marker. Default `"*"`, matching conventional-changelog output. */
    bullet?: string;

    /** How each entry's text is rendered. Default `"scope"`. */
    entryStyle?: EntryStyle;

    /** Ordered `type → section` table. Default: {@link DEFAULT_CONVENTIONAL_TYPES}. */
    types?: ReadonlyArray<ConventionalTypeRule>;

    /**
     * Heading for the catch-all section, used when `types` has no
     * `{ type: "other" }` rule to place and name it.
     * Default: {@link DEFAULT_UNCATEGORIZED_SECTION}.
     */
    uncategorizedSection?: string;
}

/**
 * Prefix `line` with `bullet` unless the author already wrote a list marker.
 *
 * "Already a marker" is {@link hasBulletMarker}'s definition, shared with the
 * parser's `stripBulletMarker`, so a `+ ` bullet isn't stripped in one place
 * and re-bulleted in the other.
 */
export const withBullet = (line: string, bullet: string): string => (hasBulletMarker(line) ? line : `${bullet} ${line}`);

/**
 * Render one entry as a finished Markdown list item: `* **scope:** subject`
 * when the header carries a scope and the style lifts it, the bare subject
 * when it doesn't, and the authored line verbatim when no rule claims it.
 */
const renderEntry = (entry: GroupableEntry, parsed: ParsedConventionalHeader | undefined, bullet: string, style: EntryStyle): string => {
    const suffix = entry.suffix ?? "";

    if (style === "verbatim") {
        return `${withBullet(entry.line, bullet)}${suffix}`;
    }

    if (!parsed) {
        return `${bullet} ${stripBulletMarker(entry.line)}${suffix}`;
    }

    return parsed.scope ? `${bullet} **${parsed.scope}:** ${parsed.subject}${suffix}` : `${bullet} ${parsed.subject}${suffix}`;
};

/** Push `### &lt;section>` plus its items, skipping the section when it has none. */
const pushSection = (lines: string[], section: string, items: ReadonlyArray<string>, trailingBlank: boolean): void => {
    if (items.length === 0) {
        return;
    }

    lines.push(`### ${section}`, "");
    lines.push(...items);

    if (trailingBlank) {
        lines.push("");
    }
};

/**
 * Bucket `entries` by conventional-commit type and render them as Markdown
 * lines (`### &lt;section>` followed by a bullet list, blank-line separated).
 *
 * Ordering follows the `types` array; types sharing a section heading are
 * merged under it, emitted at the position of the first rule that names it.
 * Hidden types are omitted. Everything no rule claims — unparseable lines and
 * unmapped types alike — is emitted under the catch-all section, which sits
 * where the table's `{ type: "other" }` rule places it or, when the table has
 * none, after every other section.
 */
export const renderGroupedEntries = (entries: ReadonlyArray<GroupableEntry>, options: RenderGroupedOptions = {}): string[] => {
    const bullet = options.bullet ?? "*";
    const entryStyle = options.entryStyle ?? "scope";
    const rules = options.types ?? DEFAULT_CONVENTIONAL_TYPES;
    const breakingSection = options.breakingSection === undefined ? DEFAULT_BREAKING_SECTION : options.breakingSection;
    const uncategorizedSection = options.uncategorizedSection ?? DEFAULT_UNCATEGORIZED_SECTION;
    const breakingType = options.breakingType?.toLowerCase();

    /**
     * First rule per type — a table may repeat a type, and only the first one
     * speaks for it. Rendering walks `canonicalRules` rather than the raw
     * table so a repeat can neither append the same bucket twice nor override
     * an earlier `hidden: true` (which would render a type the author had
     * explicitly hidden).
     */
    const ruleByType = new Map<string, ConventionalTypeRule>();
    const canonicalRules: ConventionalTypeRule[] = [];

    for (const rule of rules) {
        const type = rule.type.toLowerCase();

        if (!ruleByType.has(type)) {
            ruleByType.set(type, rule);
            canonicalRules.push(rule);
        }
    }

    const byType = new Map<string, string[]>();
    const breaking: string[] = [];

    for (const entry of entries) {
        const parsed = parseConventionalHeader(entry.line);
        const type = parsed === undefined ? UNCATEGORIZED_TYPE : breakingType !== undefined && parsed.breakingMarker ? breakingType : parsed.type;
        // A type with no rule is rendered like an unparsed line: kept verbatim,
        // so `foo: …` reaches the catch-all with its prefix intact.
        const text = renderEntry(entry, ruleByType.has(type) ? parsed : undefined, bullet, entryStyle);

        if (breakingSection !== false && parsed !== undefined && isBreakingChange(parsed)) {
            breaking.push(text);
        }

        const bucket = byType.get(type) ?? [];

        bucket.push(text);
        byType.set(type, bucket);
    }

    /** The catch-all: the unparsed bucket plus every bucket no rule claims, in first-seen order. */
    const uncategorized = (): string[] => {
        const items: string[] = [];

        for (const [type, bucket] of byType) {
            if (type !== UNCATEGORIZED_TYPE && ruleByType.has(type)) {
                continue;
            }

            items.push(...bucket);
        }

        return items;
    };

    const lines: string[] = [];

    if (breakingSection !== false) {
        pushSection(lines, breakingSection, breaking, true);
    }

    const rendered = new Set<string>();

    for (const rule of canonicalRules) {
        const type = rule.type.toLowerCase();

        if (rule.hidden || rendered.has(type)) {
            continue;
        }

        rendered.add(type);

        if (type === UNCATEGORIZED_TYPE) {
            pushSection(lines, rule.section, uncategorized(), true);

            continue;
        }

        // Several types may share a section (`feat` + `feature` → `Features`);
        // emit the heading once, in the position of its first rule.
        const items: string[] = [];

        for (const other of canonicalRules) {
            const otherType = other.type.toLowerCase();

            if (other.hidden || otherType === UNCATEGORIZED_TYPE || other.section !== rule.section) {
                continue;
            }

            rendered.add(otherType);
            items.push(...(byType.get(otherType) ?? []));
        }

        pushSection(lines, rule.section, items, true);
    }

    // No `other` rule to place the catch-all: append it last, unless the table
    // opted out with `{ type: "other", hidden: true }`. No trailing blank —
    // callers append their own trailing content (dependency notes, credits)
    // straight after.
    if (!rendered.has(UNCATEGORIZED_TYPE) && ruleByType.get(UNCATEGORIZED_TYPE)?.hidden !== true) {
        pushSection(lines, uncategorizedSection, uncategorized(), false);
    }

    return lines;
};
