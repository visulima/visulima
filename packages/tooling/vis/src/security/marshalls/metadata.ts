/**
 * Metadata marshall — combined README / license / repo presence check.
 *
 * Bundles README, license, and repository presence checks into a single
 * pass since they share inputs (the resolved version entry on the
 * packument) and all yield warnings only.
 *
 * One {@link MetadataFinding} per package — the `issues` array carries
 * every problem so console output stays compact when a package is missing
 * everything.
 */

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument, PackumentVersionEntry } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export type MetadataIssue = "invalid-repo-url" | "missing-license" | "missing-readme" | "missing-repo" | "placeholder-readme";

export type MetadataCheck = "license" | "readme" | "repo";

export interface MetadataFinding {
    issues: MetadataIssue[];
    packageName: string;
    version: string;
}

export interface RunMetadataMarshallOptions {
    allowlist?: string[];
    /** Subset of checks to run. Defaults to `["readme", "license", "repo"]`. */
    checks?: MetadataCheck[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    workspaceRoot?: string;
}

const DEFAULT_CHECKS: MetadataCheck[] = ["readme", "license", "repo"];

const PLACEHOLDER_PREFIXES = ["ERROR: No README data found!", "# Security holding package"];

const isPlaceholderReadme = (readme: string): boolean => {
    const trimmed = readme.trim();

    if (trimmed === "") {
        return true;
    }

    return PLACEHOLDER_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
};

const getReadme = (packument: Packument, entry: PackumentVersionEntry): string | undefined => {
    if (typeof entry.readme === "string") {
        return entry.readme;
    }

    if (typeof packument.readme === "string") {
        return packument.readme;
    }

    return undefined;
};

const checkReadme = (packument: Packument, entry: PackumentVersionEntry): MetadataIssue | undefined => {
    const readme = getReadme(packument, entry);

    if (readme === undefined) {
        return "missing-readme";
    }

    if (isPlaceholderReadme(readme)) {
        return "placeholder-readme";
    }

    return undefined;
};

const checkLicense = (entry: PackumentVersionEntry): MetadataIssue | undefined => {
    const { license } = entry;

    if (license === undefined) {
        return "missing-license";
    }

    if (typeof license === "string") {
        return license.trim() === "" ? "missing-license" : undefined;
    }

    return typeof license.type === "string" && license.type.trim() !== "" ? undefined : "missing-license";
};

const checkRepository = (entry: PackumentVersionEntry): MetadataIssue | undefined => {
    const { repository } = entry;

    if (repository === undefined) {
        return "missing-repo";
    }

    const rawUrl = typeof repository.url === "string" ? repository.url.trim() : "";

    if (rawUrl === "") {
        return "missing-repo";
    }

    let candidate = rawUrl.replace(/^git\+/, "");
    const sshShorthand = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(candidate);

    if (sshShorthand) {
        candidate = `https://${sshShorthand[1]}/${sshShorthand[2]}`;
    }

    return URL.canParse(candidate) ? undefined : "invalid-repo-url";
};

const resolveLatestVersion = (packument: Packument): string | undefined => {
    const tag = packument["dist-tags"]?.latest;

    if (tag !== undefined && Object.hasOwn(packument.versions, tag)) {
        return tag;
    }

    const versions = Object.keys(packument.versions);

    return versions.at(-1);
};

export const runMetadataMarshall = async (
    packages: { name: string; version: string }[],
    options: RunMetadataMarshallOptions = {},
): Promise<MetadataFinding[]> => {
    if (isMarshallDisabled("metadata")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const checks = new Set<MetadataCheck>(options.checks ?? DEFAULT_CHECKS);
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<MetadataFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        const entry = packument.versions[version] ?? packument.versions[resolveLatestVersion(packument) ?? ""];

        if (entry === undefined) {
            return undefined;
        }

        if (entry.private === true) {
            return undefined;
        }

        const issues: MetadataIssue[] = [];

        if (checks.has("readme")) {
            const readmeIssue = checkReadme(packument, entry);

            if (readmeIssue !== undefined) {
                issues.push(readmeIssue);
            }
        }

        if (checks.has("license")) {
            const licenseIssue = checkLicense(entry);

            if (licenseIssue !== undefined) {
                issues.push(licenseIssue);
            }
        }

        if (checks.has("repo")) {
            const repoIssue = checkRepository(entry);

            if (repoIssue !== undefined) {
                issues.push(repoIssue);
            }
        }

        if (issues.length === 0) {
            return undefined;
        }

        return { issues, packageName: name, version };
    });

    return perPackage.filter((entry): entry is MetadataFinding => entry !== undefined);
};
