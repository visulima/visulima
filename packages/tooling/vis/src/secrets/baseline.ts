import { isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { isAbsolute, relative } from "@visulima/path";
import type { Finding } from "@visulima/secret-scanner";
import { fingerprint } from "@visulima/secret-scanner";

const toRelative = (file: string, root: string): string => {
    if (!isAbsolute(file)) {
        return file;
    }

    const rel = relative(root, file);

    return rel === "" || rel.startsWith("..") ? file : rel;
};

/** Convert a finding to the shape we persist in baselines (with paths relative to root). */
export const toRelativeFinding = (f: Finding, root: string): Finding => {
    const relativeFile = toRelative(f.file, root);

    return relativeFile === f.file ? f : { ...f, file: relativeFile };
};

const readBaseline = (baselinePath: string): Finding[] => {
    if (!isAccessibleSync(baselinePath)) {
        return [];
    }

    try {
        const parsed = readJsonSync(baselinePath) as unknown;

        return Array.isArray(parsed) ? (parsed as Finding[]) : [];
    } catch {
        return [];
    }
};

export interface BaselineDiff {
    fresh: Finding[];
    resolved: Finding[];
    surviving: Finding[];
}

/** Compare current findings against an existing baseline. */
export const diffBaseline = (findings: Finding[], baselinePath: string, root: string): BaselineDiff => {
    const existing = readBaseline(baselinePath).map((f) => toRelativeFinding(f, root));
    const existingKeys = new Set(existing.map((f) => fingerprint(f)));
    const currentRelative = findings.map((f) => toRelativeFinding(f, root));
    const currentKeys = new Set(currentRelative.map((f) => fingerprint(f)));

    return {
        fresh: currentRelative.filter((f) => !existingKeys.has(fingerprint(f))),
        resolved: existing.filter((f) => !currentKeys.has(fingerprint(f))),
        surviving: currentRelative.filter((f) => existingKeys.has(fingerprint(f))),
    };
};

export interface WriteBaselineOptions {
    /** If true, replace the file instead of merging with existing entries. */
    replace?: boolean;
}

/**
 * Write `findings` to `baselinePath` with paths relative to `root`. By default
 * merges with any existing baseline (so prior triage decisions for files not
 * rescanned this run are preserved). Pass `replace: true` to overwrite.
 */
export const writeBaseline = (findings: Finding[], baselinePath: string, root: string, options: WriteBaselineOptions = {}): number => {
    const incoming = findings.map((f) => toRelativeFinding(f, root));
    let final: Finding[];

    if (options.replace) {
        final = incoming;
    } else {
        const existing = readBaseline(baselinePath).map((f) => toRelativeFinding(f, root));
        const seen = new Set<string>();

        final = [];

        for (const f of [...existing, ...incoming]) {
            const key = fingerprint(f);

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            final.push(f);
        }
    }

    writeFileSync(baselinePath, `${JSON.stringify(final, null, 4)}\n`);

    return final.length;
};
