/**
 * Cross-checks the project's own environment declarations against each
 * other: `.nvmrc` / `.node-version` / `engines.node` / `devEngines.runtime`
 * / `volta.node` for Node.js, and `packageManager` / `devEngines.packageManager`
 * for the package manager. Also validates the integrity suffix of a
 * `packageManager` pin.
 *
 * Warnings only. When declarations disagree vis never picks a winner
 * (the toolchain merge in `parseExpectedTools` still does, but that is
 * its own behaviour); the doctor just reports that the workspace says
 * two different things.
 */
import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { intersects, validRange } from "semver";

import type { RuntimeDiagnostic } from "./runtime-diagnostics";

/** Expected hex digest length per algorithm, as corepack writes them (`+sha512.&lt;hex>`). */
const INTEGRITY_HEX_LENGTHS: Readonly<Record<string, number>> = {
    sha1: 40,
    sha224: 56,
    sha256: 64,
    sha384: 96,
    sha512: 128,
};

/**
 * Validates the `+&lt;algo>.&lt;hex>` suffix of a `packageManager` value such as
 * `pnpm@10.18.0+sha512.&lt;hex>`. Returns a message when the suffix is present
 * but malformed; `undefined` when there is no suffix or it is well-formed.
 * Nothing is downloaded or compared against a registry.
 *
 * Corepack compares the digest against lowercase hex, so uppercase digits
 * are reported as malformed rather than accepted.
 */
export const checkPackageManagerIntegrity = (field: string): string | undefined => {
    const plus = field.indexOf("+");

    if (plus === -1) {
        return undefined;
    }

    const suffix = field.slice(plus + 1);
    const match = /^([a-z0-9]+)\.([0-9a-f]+)$/.exec(suffix);
    const expectedLength = match ? INTEGRITY_HEX_LENGTHS[match[1]!] : undefined;

    if (match && expectedLength !== undefined && match[2]!.length === expectedLength) {
        return undefined;
    }

    return `packageManager "${field}" has a malformed integrity suffix. Expected "+<algo>.<hex>" with algo sha1, sha224, sha256, sha384 or sha512 and lowercase hex of the matching length (sha512 = 128 characters).`;
};

interface Entry {
    /** Tool name the entry constrains (`node`, `pnpm`, ...). */
    readonly name: string;
    /** Valid semver range; `*` when the declaration names no version. */
    readonly range: string;
}

interface Declaration {
    readonly entries: ReadonlyArray<Entry>;
    /** Where the declaration lives, e.g. `.nvmrc` or `devEngines.packageManager`. */
    readonly label: string;
    /** The raw value(s) as written, for the message. */
    readonly value: string;
}

const NODE_FILES = [".nvmrc", ".node-version"] as const;

const readRootPackage = (workspaceRoot: string): Record<string, unknown> => {
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return {};
    }

    try {
        return (readJsonSync(pkgPath) as Record<string, unknown>) ?? {};
    } catch {
        return {};
    }
};

/**
 * Turns one declaration into semver-checkable entries. Ranges that are not
 * semver (`lts/*`, `latest`, `stable`) are dropped: they cannot be compared,
 * so they can neither conflict nor agree.
 */
const toDeclaration = (label: string, raw: ReadonlyArray<{ name: string; version?: unknown }>): Declaration | undefined => {
    const entries: Entry[] = [];

    for (const { name, version } of raw) {
        const text = typeof version === "string" && version.trim() !== "" ? version.trim() : "*";

        if (validRange(text) !== null) {
            entries.push({ name, range: text });
        }
    }

    if (entries.length === 0) {
        return undefined;
    }

    return {
        entries,
        label,
        value: raw.map((r) => (typeof r.version === "string" && r.version !== "" ? `${r.name}@${r.version}` : r.name)).join(" | "),
    };
};

/**
 * `devEngines.&lt;tool>` is either one object or an array of alternatives. An
 * array means "any of these", so it is one declaration whose entries are all
 * alternatives, not several declarations to compare with each other.
 */
const devEnginesEntries = (value: unknown, tool?: string): { name: string; version?: unknown }[] => {
    const list = Array.isArray(value) ? value : [value];
    const result: { name: string; version?: unknown }[] = [];

    for (const item of list) {
        if (typeof item !== "object" || item === null) {
            continue;
        }

        const { name, version } = item as { name?: unknown; version?: unknown };

        if (typeof name !== "string" || (tool !== undefined && name !== tool)) {
            continue;
        }

        result.push({ name, version });
    }

    return result;
};

const readNodeVersionFile = (workspaceRoot: string, name: (typeof NODE_FILES)[number]): string | undefined => {
    const path = join(workspaceRoot, name);

    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        const content = readFileSync(path).trim();

        return content === "" ? undefined : content;
    } catch {
        return undefined;
    }
};

const collectNodeDeclarations = (workspaceRoot: string, pkg: Record<string, unknown>): Declaration[] => {
    const declarations: (Declaration | undefined)[] = [];

    for (const file of NODE_FILES) {
        const value = readNodeVersionFile(workspaceRoot, file);

        if (value !== undefined) {
            declarations.push(toDeclaration(file, [{ name: "node", version: value }]));
        }
    }

    const engines = pkg.engines as Record<string, unknown> | undefined;

    if (engines && typeof engines.node === "string") {
        declarations.push(toDeclaration("engines.node", [{ name: "node", version: engines.node }]));
    }

    const devEngines = pkg.devEngines as Record<string, unknown> | undefined;

    if (devEngines?.runtime !== undefined) {
        declarations.push(toDeclaration("devEngines.runtime", devEnginesEntries(devEngines.runtime, "node")));
    }

    const volta = pkg.volta as Record<string, unknown> | undefined;

    if (volta && typeof volta.node === "string") {
        declarations.push(toDeclaration("volta.node", [{ name: "node", version: volta.node }]));
    }

    return declarations.filter((d): d is Declaration => d !== undefined);
};

const collectPackageManagerDeclarations = (pkg: Record<string, unknown>): { declarations: Declaration[]; integrityIssues: string[] } => {
    const declarations: (Declaration | undefined)[] = [];
    const integrityIssues: string[] = [];

    if (typeof pkg.packageManager === "string") {
        const field = pkg.packageManager;
        const integrity = checkPackageManagerIntegrity(field);

        if (integrity) {
            integrityIssues.push(integrity);
        }

        // Only the part before the integrity suffix is a name@version pin.
        const [pin] = field.split("+", 1);
        const match = /^([^@]+)@(.+)$/.exec(pin ?? "");

        if (match) {
            declarations.push(toDeclaration("packageManager", [{ name: match[1]!, version: match[2] }]));
        }
    }

    const devEngines = pkg.devEngines as Record<string, unknown> | undefined;

    if (devEngines?.packageManager !== undefined) {
        const entries = devEnginesEntries(devEngines.packageManager);

        declarations.push(toDeclaration("devEngines.packageManager", entries));
    }

    return { declarations: declarations.filter((d): d is Declaration => d !== undefined), integrityIssues };
};

/** `true` when at least one entry of `a` and one of `b` name the same tool and share a version. */
const agrees = (a: Declaration, b: Declaration): boolean =>
    a.entries.some((x) => b.entries.some((y) => x.name === y.name && intersects(x.range, y.range)));

const findConflicts = (kind: string, declarations: ReadonlyArray<Declaration>): string[] => {
    const messages: string[] = [];

    for (let i = 0; i < declarations.length; i++) {
        for (let j = i + 1; j < declarations.length; j++) {
            const a = declarations[i]!;
            const b = declarations[j]!;

            if (!agrees(a, b)) {
                messages.push(`Conflicting ${kind} declarations: ${a.label} (${a.value}) and ${b.label} (${b.value}) have no version in common. vis does not pick one; align them.`);
            }
        }
    }

    return messages;
};

/**
 * Runs every environment-consistency check for the workspace root and
 * returns doctor-ready diagnostics. Always returns at least one entry:
 * `skip` when nothing is declared, `ok` when everything agrees, otherwise
 * one `warn` per conflict or malformed integrity suffix.
 */
export const checkProjectEnvironment = (workspaceRoot: string): RuntimeDiagnostic[] => {
    const pkg = readRootPackage(workspaceRoot);
    const nodeDeclarations = collectNodeDeclarations(workspaceRoot, pkg);
    const { declarations: pmDeclarations, integrityIssues } = collectPackageManagerDeclarations(pkg);

    const declaredCount = nodeDeclarations.length + pmDeclarations.length;

    if (declaredCount === 0 && integrityIssues.length === 0) {
        return [{ id: "env-declarations", message: "No Node.js or package-manager declarations to cross-check.", status: "skip" }];
    }

    const warnings: RuntimeDiagnostic[] = [
        ...findConflicts("Node.js", nodeDeclarations),
        ...findConflicts("package-manager", pmDeclarations),
    ].map((message) => { return { id: "env-conflict", message, status: "warn" as const }; });

    for (const message of integrityIssues) {
        warnings.push({ id: "env-integrity", message, status: "warn" });
    }

    if (warnings.length === 0) {
        return [
            {
                id: "env-declarations",
                message: `Node.js and package-manager declarations agree (${declaredCount} checked).`,
                status: "ok",
            },
        ];
    }

    return warnings;
};
