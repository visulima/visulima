/**
 * The release heading a formatter writes above each entry block: a
 * `releaseTagPattern`-style template (tokens `{name}`, `{version}`, `{date}`,
 * `{compareUrl}`) plus the compare-URL builder that fills its one non-trivial
 * token.
 *
 * Both live here because the URL exists only to be substituted into the
 * template, and the template has to know how to degrade when there isn't one.
 */

import { renderTagPattern } from "../git";
import type { RemoteProvider } from "../remote/interface";
import { remoteWebUrls } from "../remote/web-urls";

/** Values substituted into a `heading` template. */
export interface ReleaseHeadingTokens {
    /** Version-comparison URL. Omit / leave empty when there is nothing to compare against. */
    compareUrl?: string;
    /** ISO date `YYYY-MM-DD`. */
    date: string;
    /** Package name. */
    name: string;
    /** The version being released. */
    version: string;
}

const HEADING_TOKEN_RE = /\{(name|version|date|compareUrl)\}/g;

const COMPARE_LINK_TAIL = "]({compareUrl})";

/**
 * Unwrap `[…]({compareUrl})` link syntax when there is no compare URL, so
 * `## {name} [{version}]({compareUrl}) ({date})` degrades to
 * `## \@scope/pkg 1.0.0 (2026-09-08)` instead of emitting a dangling `[1.0.0]()`.
 *
 * Implemented with `indexOf`/`slice` rather than a regex: the equivalent
 * `\[[^\]]*\]\(\)` pattern is exactly the unanchored shape CodeQL flags as
 * polynomial ReDoS.
 */
const stripEmptyCompareLink = (template: string): string => {
    let out = template;
    let index = out.indexOf(COMPARE_LINK_TAIL);

    while (index !== -1) {
        const open = out.lastIndexOf("[", index);

        out
            = open === -1
                ? out.slice(0, index) + out.slice(index + COMPARE_LINK_TAIL.length)
                : out.slice(0, open) + out.slice(open + 1, index) + out.slice(index + COMPARE_LINK_TAIL.length);

        index = out.indexOf(COMPARE_LINK_TAIL);
    }

    return out;
};

/**
 * Render a release heading from a template. Recognised tokens:
 *
 *   `{name}`       — package name (`@scope/pkg`)
 *   `{version}`    — the version being released
 *   `{date}`       — ISO date `YYYY-MM-DD`
 *   `{compareUrl}` — version-comparison URL, or nothing
 *
 * Mirrors `renderTagPattern`: unknown `{x}` tokens are left intact so a typo
 * shows up in the output rather than silently vanishing.
 */
export const renderReleaseHeading = (template: string, tokens: ReleaseHeadingTokens): string => {
    const compareUrl = tokens.compareUrl ?? "";
    const resolved = compareUrl === "" ? stripEmptyCompareLink(template) : template;
    const values: Record<string, string> = {
        compareUrl,
        date: tokens.date,
        name: tokens.name,
        version: tokens.version,
    };

    return resolved.replaceAll(HEADING_TOKEN_RE, (_match, key: string) => values[key] ?? "");
};

export interface CompareUrlInput {
    /** Override the URL prefix (self-hosted GitLab, Gitea, …). Wins over `repo`. */
    compareUrlPrefix?: string;
    name: string;
    newVersion: string;
    /** Previous version. Absent / empty on a first release → no compare URL. */
    oldVersion?: string;

    /**
     * Forge the `repo` slug lives on — it decides the URL shape (GitLab nests
     * the comparison under `/-/`). Default `"github"`.
     */
    provider?: RemoteProvider;
    /** `owner/name` slug, resolved against the provider's public web host. */
    repo?: string;
    /** Tag template used to name both ends of the comparison. Default `"{name}@{version}"`. */
    tagPattern?: string;
}

/**
 * Build a `…/compare/&lt;fromTag>...&lt;toTag>` URL, or `undefined` when there's
 * nothing to point at — no remote configured, or no previous version (first
 * release). Callers pass the result straight to {@link renderReleaseHeading},
 * which degrades the link syntax when it's `undefined`.
 */

/**
 * Drop trailing `/` characters.
 *
 * A linear scan rather than `replace(/\/+$/, "")`: the regex form has an
 * unanchored start, so the engine retries the `+` at every offset and a base
 * URL of many slashes costs O(n²) (CodeQL polynomial-redos, alert 583).
 */
const stripTrailingSlashes = (value: string): string => {
    let end = value.length;

    // 47 === "/"
    while (end > 0 && value.codePointAt(end - 1) === 47) {
        end -= 1;
    }

    return end === value.length ? value : value.slice(0, end);
};

export const buildCompareUrl = (input: CompareUrlInput): string | undefined => {
    const { compareUrlPrefix, name, newVersion, oldVersion, repo } = input;

    if (!oldVersion) {
        return undefined;
    }

    const pattern = input.tagPattern ?? "{name}@{version}";
    const fromTag = renderTagPattern(pattern, { name, version: oldVersion });
    const toTag = renderTagPattern(pattern, { name, version: newVersion });

    // An explicit prefix is already a repo URL — append the path GitHub/Gitea
    // use, which is also what this option has always meant.
    if (compareUrlPrefix) {
        return `${stripTrailingSlashes(compareUrlPrefix)}/compare/${fromTag}...${toTag}`;
    }

    if (!repo) {
        return undefined;
    }

    return remoteWebUrls(input.provider ?? "github", repo).compare(fromTag, toTag);
};
