/**
 * Changelog resolution for the dlx first-run panel.
 *
 * Resolution order (per product decision):
 *   1. The package's own bundled CHANGELOG file, served from the jsDelivr npm
 *      CDN at the exact resolved version (no install needed).
 *   2. A CHANGELOG file in the package's GitHub repository (raw.githubusercontent).
 *   3. Fallback: an npm version "diff" derived from packument timestamps —
 *      latest version, publish age, and the few preceding releases.
 *
 * Everything is best-effort and time-boxed: any failure falls through to the
 * next strategy, and the npm-diff fallback always produces *something* as long
 * as the packument is available.
 */

import type { Packument } from "../security/marshalls/packument";
import { sanitizeTerminalText } from "../util/sanitize-terminal";

/** Common changelog filenames, in priority order. */
const CHANGELOG_FILENAMES = ["CHANGELOG.md", "CHANGELOG", "changelog.md", "CHANGES.md", "HISTORY.md"] as const;

const DEFAULT_TIMEOUT_MS = 4000;

export interface ChangelogResult {
    /** Up to a handful of summary lines for the panel. */
    lines: string[];
    /** Where the changelog came from. */
    source: "npm-diff" | "package-file" | "repo-file";
    /** A clickable source link when available. */
    url?: string;
    /** The resolved version the changelog describes. */
    version: string;
}

const fetchText = async (url: string, signal: AbortSignal | undefined, headers?: Record<string, string>): Promise<string | undefined> => {
    // An already-aborted signal never fires its `abort` event, so bail out
    // before arming the timeout — otherwise looped callers would each wait the
    // full budget on a signal whose listener will never run.
    if (signal?.aborted) {
        return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, DEFAULT_TIMEOUT_MS);
    const onAbort = (): void => {
        controller.abort();
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    try {
        const response = await fetch(url, { headers, signal: controller.signal });

        if (!response.ok) {
            return undefined;
        }

        return await response.text();
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
    }
};

/** Parse a packument `repository` field into `{ owner, repo, directory }`. */
export const parseGitHubRepo = (
    repository: { directory?: string; url?: string } | string | undefined,
): { directory?: string; owner: string; repo: string } | undefined => {
    const raw = typeof repository === "string" ? repository : repository?.url;

    if (!raw) {
        return undefined;
    }

    // Matches git+https://github.com/owner/repo.git, git@github.com:owner/repo, github:owner/repo, https://github.com/owner/repo/tree/main/dir
    const match = /github\.com[/:]([^/]+)\/([^/#]+?)(?:\.git)?(?:[/#]|$)/i.exec(raw) ?? /^github:([^/]+)\/([^/#]+)/i.exec(raw);

    if (!match) {
        return undefined;
    }

    const directory = typeof repository === "object" ? repository?.directory : undefined;

    return { directory, owner: match[1] as string, repo: (match[2] as string).replace(/\.git$/, "") };
};

/**
 * Extract the section of a markdown changelog that documents `version`.
 * Finds the first heading whose text mentions the version and captures lines
 * until the next heading at the same or a higher level. Returns undefined when
 * no matching heading is found.
 */
export const extractVersionSection = (markdown: string, version: string): string[] | undefined => {
    const lines = markdown.split(/\r?\n/);
    const headingRe = /^(#{1,4})\s+(.*)$/;
    // Match the version as a whole token so `5.2.0` doesn't match `15.2.0` / `5.2.10`.
    const escaped = version.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
    const versionRe = new RegExp(String.raw`(?<![\w.])${escaped}(?![\w.])`);
    let startIndex = -1;
    let startLevel = 0;

    for (const [index, line] of lines.entries()) {
        const match = headingRe.exec(line);

        if (match && versionRe.test(match[2] as string)) {
            startIndex = index;
            startLevel = (match[1] as string).length;
            break;
        }
    }

    if (startIndex === -1) {
        return undefined;
    }

    const collected: string[] = [];

    for (let index = startIndex + 1; index < lines.length; index += 1) {
        const match = headingRe.exec(lines[index] as string);

        if (match && (match[1] as string).length <= startLevel) {
            break;
        }

        collected.push(lines[index] as string);
    }

    return collected;
};

/** Condense raw changelog/section text into a few clean bullet lines for the panel. */
export const summarizeChangelog = (raw: string[], maxLines = 4): string[] => {
    const cleaned = raw
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        // Drop sub-headings like "### Bug Fixes" — keep the actual entries.
        .map((line) => sanitizeTerminalText(line.replace(/^#{1,6}\s+/, "").replace(/^[*-]\s+/, "- ")).trim())
        .filter((line) => line.length > 0 && !/^\[.*\]:/.test(line));

    return cleaned.slice(0, maxLines);
};

const relativeAge = (iso: string | undefined, now: number): string => {
    if (!iso) {
        return "";
    }

    const published = Date.parse(iso);

    if (Number.isNaN(published)) {
        return "";
    }

    const days = Math.floor((now - published) / (24 * 60 * 60 * 1000));

    if (days <= 0) {
        return "today";
    }

    if (days === 1) {
        return "1d ago";
    }

    if (days < 30) {
        return `${String(days)}d ago`;
    }

    const months = Math.floor(days / 30);

    return months < 12 ? `${String(months)}mo ago` : `${String(Math.floor(months / 12))}y ago`;
};

/** Build the npm-diff fallback from packument timestamps. */
const buildNpmDiff = (packument: Packument, version: string, now: number): ChangelogResult => {
    const times = packument.time ?? {};
    const age = relativeAge(times[version], now);
    const lines = [age ? `${packument.name}@${version} — published ${age}` : `${packument.name}@${version}`];

    // List the few preceding releases with their ages.
    const targetTime = Date.parse(times[version] ?? "");
    const ordered = Object.entries(times)
        .filter(([key]) => key !== "created" && key !== "modified" && key !== version)
        .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));

    const previous = ordered.filter(([, iso]) => Date.parse(iso) < targetTime).slice(0, 3);

    for (const [previousVersion, iso] of previous) {
        lines.push(`- ${previousVersion} (${relativeAge(iso, now)})`);
    }

    return { lines, source: "npm-diff", version };
};

export interface FetchChangelogOptions {
    name: string;
    now: number;
    /** Skip CDN / GitHub fetches and go straight to the packument-derived diff. */
    offline?: boolean;
    packument: Packument | undefined;
    signal?: AbortSignal;
    version: string;
}

/**
 * Resolve a changelog for the panel following the bundled-file → repo-file →
 * npm-diff order. Always returns a result when a packument is available
 * (falling back to the npm diff); returns undefined only when there is nothing
 * at all to show.
 */
export const fetchChangelog = async (options: FetchChangelogOptions): Promise<ChangelogResult | undefined> => {
    const { name, now, offline, packument, signal, version } = options;

    // Offline: the registry is unreachable; only the packument-derived diff is possible.
    if (offline) {
        return packument ? buildNpmDiff(packument, version, now) : undefined;
    }

    // 1. Bundled CHANGELOG file via jsDelivr (exact version).
    for (const filename of CHANGELOG_FILENAMES) {
        const url = `https://cdn.jsdelivr.net/npm/${name}@${version}/${filename}`;

        const text = await fetchText(url, signal);

        if (text) {
            const section = extractVersionSection(text, version);
            const lines = summarizeChangelog(section ?? text.split(/\r?\n/));

            if (lines.length > 0) {
                return { lines, source: "package-file", url, version };
            }
        }
    }

    // 2. CHANGELOG file in the GitHub repository.
    const versionEntry = packument?.versions[version];
    const repo = parseGitHubRepo(versionEntry?.repository);

    if (repo) {
        const directoryPrefix = repo.directory ? `${repo.directory.replaceAll(/^\/+|\/+$/g, "")}/` : "";

        for (const branch of ["HEAD", "main", "master"]) {
            for (const filename of CHANGELOG_FILENAMES) {
                const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${directoryPrefix}${filename}`;

                const text = await fetchText(url, signal);

                if (text) {
                    const section = extractVersionSection(text, version);
                    const lines = summarizeChangelog(section ?? text.split(/\r?\n/));

                    if (lines.length > 0) {
                        const webUrl = `https://github.com/${repo.owner}/${repo.repo}/blob/${branch}/${directoryPrefix}${filename}`;

                        return { lines, source: "repo-file", url: webUrl, version };
                    }
                }
            }
        }
    }

    // 3. npm version diff fallback.
    if (packument) {
        return buildNpmDiff(packument, version, now);
    }

    return undefined;
};
