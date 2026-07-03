import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { whichBin } from "#native";

/**
 * Runtime-version mismatch finding. vis doesn't manage runtimes directly,
 * but it can warn when the currently running Node/Bun/Deno doesn't match
 * whatever the repo has declared — usually a sign the user forgot to
 * switch runtimes for this workspace.
 */
export interface RuntimeFinding {
    actual: string;
    expected: string;
    kind: "node" | "packageManager";
    message: string;
    severity: "error" | "warning";
}

interface RootPackageJson {
    engines?: { bun?: string; node?: string; npm?: string; pnpm?: string; yarn?: string };
    packageManager?: string;
}

/**
 * Tries to read a `.nvmrc` or `.node-version` file at the workspace root.
 */
const readNodeVersionFile = (workspaceRoot: string): string | undefined => {
    for (const name of [".nvmrc", ".node-version"]) {
        const path = join(workspaceRoot, name);

        if (!isAccessibleSync(path)) {
            continue;
        }

        try {
            const content = readFileSync(path).trim();

            return content.replace(/^v/, "");
        } catch {
            // ignore
        }
    }

    return undefined;
};

/**
 * Compares two dotted version strings. Returns negative if a < b,
 * 0 if equal, positive if a > b. Non-numeric components are ignored.
 */
const compareVersions = (a: string, b: string): number => {
    const aParts = a.split(/[.\-+]/).map((p) => Number.parseInt(p, 10) || 0);
    const bParts = b.split(/[.\-+]/).map((p) => Number.parseInt(p, 10) || 0);

    const len = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < len; i++) {
        const ai = aParts[i] ?? 0;
        const bi = bParts[i] ?? 0;

        if (ai !== bi) {
            return ai - bi;
        }
    }

    return 0;
};

/**
 * Evaluates a minimal subset of semver ranges: `>=X`, `X.Y`, `X.Y.Z`,
 * and compound `>=X &lt;Y`. Returns true if `actual` satisfies the range.
 * Falls back to "true" for unrecognised syntax rather than false so we
 * don't spam warnings on exotic ranges.
 */
export const satisfiesRange = (actual: string, range: string): boolean => {
    const normalized = range.trim();

    if (normalized === "" || normalized === "*") {
        return true;
    }

    const clauses = normalized.split(/\s+/).filter(Boolean);

    for (const clause of clauses) {
        if (clause.startsWith(">=")) {
            if (compareVersions(actual, clause.slice(2).trim()) < 0) {
                return false;
            }
        } else if (clause.startsWith("<=")) {
            if (compareVersions(actual, clause.slice(2).trim()) > 0) {
                return false;
            }
        } else if (clause.startsWith(">")) {
            if (compareVersions(actual, clause.slice(1).trim()) <= 0) {
                return false;
            }
        } else if (clause.startsWith("<")) {
            if (compareVersions(actual, clause.slice(1).trim()) >= 0) {
                return false;
            }
        } else if (/^\d/.test(clause)) {
            const actualParts = actual.split(".");
            const clauseParts = clause.split(".");

            for (const [i, clausePart] of clauseParts.entries()) {
                if (clausePart !== actualParts[i]) {
                    return false;
                }
            }
        }
    }

    return true;
};

/**
 * Checks `engines.node`, `.nvmrc`, `.node-version`, and `packageManager`
 * against the running process.
 * @param workspaceRoot Absolute path to the workspace root.
 * @returns Findings; an empty array means everything matches.
 */
export const checkRuntimeVersions = (workspaceRoot: string): RuntimeFinding[] => {
    const findings: RuntimeFinding[] = [];
    const pkgPath = join(workspaceRoot, "package.json");

    let rootPkg: RootPackageJson;

    try {
        rootPkg = readJsonSync(pkgPath) as RootPackageJson;
    } catch {
        return findings;
    }

    const actualNode = process.versions.node;

    // engines.node
    if (rootPkg.engines?.node) {
        const expected = rootPkg.engines.node;

        if (!satisfiesRange(actualNode, expected)) {
            findings.push({
                actual: actualNode,
                expected,
                kind: "node",
                message: `package.json engines.node requires ${expected}, but the current Node.js is ${actualNode}.`,
                severity: "error",
            });
        }
    }

    // .nvmrc / .node-version
    const pinnedNode = readNodeVersionFile(workspaceRoot);

    if (pinnedNode) {
        // Compare major.minor only (patch churn is fine).
        const [pinnedMajor, pinnedMinor] = pinnedNode.split(".");
        const [actualMajor, actualMinor] = actualNode.split(".");

        if (pinnedMajor !== actualMajor || (pinnedMinor !== undefined && pinnedMinor !== actualMinor)) {
            findings.push({
                actual: actualNode,
                expected: pinnedNode,
                kind: "node",
                message: `.nvmrc pins Node ${pinnedNode} but the current Node.js is ${actualNode}. Run \`nvm use\` or switch runtimes.`,
                severity: "warning",
            });
        }
    }

    // packageManager field
    if (rootPkg.packageManager) {
        const [expectedName, expectedVersion] = rootPkg.packageManager.split("@");
        const detectedFromUserAgent = (process.env["npm_config_user_agent"] ?? "").split(" ")[0] ?? "";
        const [detectedName, detectedVersion] = detectedFromUserAgent.split("/");

        // Aube enforces its own `packageManagerStrict` setting (tri-state:
        // off | warn | error, defaulting to warn) and emits a clear
        // diagnostic when the pin doesn't match. Double-erroring here
        // would mask aube's message — but only when aube is actually
        // installed and able to surface that diagnostic. Without aube on
        // PATH, vis's error stays as the only signal so the user is told
        // something is wrong.
        const aubePin = expectedName === "aube";
        const aubeAvailable = aubePin && whichBin("aube") !== null;

        if (detectedName && expectedName && detectedName !== expectedName) {
            findings.push({
                actual: detectedName,
                expected: expectedName,
                kind: "packageManager",
                message: `package.json packageManager pins ${rootPkg.packageManager} but the current invocation is ${detectedFromUserAgent}. Install the correct package manager.`,
                severity: aubeAvailable ? "warning" : "error",
            });
        } else if (detectedVersion && expectedVersion && detectedVersion !== expectedVersion) {
            findings.push({
                actual: detectedVersion,
                expected: expectedVersion,
                kind: "packageManager",
                message: `package.json packageManager pins ${expectedName}@${expectedVersion} but the current invocation uses ${expectedName}@${detectedVersion}.`,
                severity: "warning",
            });
        }
    }

    return findings;
};
