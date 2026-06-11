import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findUp } from "@visulima/fs";

import type { ToolContext, ToolDeps } from "./response";
import { registerAdvisoryStatus } from "./tools/advisory-status";
import { registerAudit } from "./tools/audit";
import { registerCacheHash } from "./tools/cache-hash";
import { registerCacheWhy } from "./tools/cache-why";
import { registerDescribeProject } from "./tools/describe-project";
import { registerDescribeTemplate } from "./tools/describe-template";
import { registerFmt } from "./tools/fmt";
import { registerGetRunLogs } from "./tools/get-run-logs";
import { registerLint } from "./tools/lint";
import { registerListProjects } from "./tools/list-projects";
import { registerListRuns } from "./tools/list-runs";
import { registerListTargets } from "./tools/list-targets";
import { registerListTemplates } from "./tools/list-templates";

interface PackageJsonShape {
    bin?: Record<string, string> | string;
    version?: string;
}

/**
 * Minimum `@visulima/vis` version vis-mcp's tools assume. The `lint`/`fmt` tools
 * rely on `--format json`, and `audit`/`advisories status` on their JSON shapes;
 * older CLIs produce opaque "no JSON output" errors instead of a clear upgrade
 * hint. Bump this in lockstep with the `peerDependencies` range whenever a new
 * tool depends on a newer CLI surface.
 */
const MIN_VIS_VERSION = "1.0.0-alpha.35";

const splitVersion = (value: string): { core: number[]; pre: string[] } => {
    const [core, pre = ""] = value.split("-", 2);

    return {
        core: (core ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0),
        pre: pre.length > 0 ? pre.split(".") : [],
    };
};

/**
 * Order two single prerelease identifiers per semver: numeric identifiers
 * compare numerically, otherwise lexically. A missing identifier (shorter
 * prerelease chain) sorts lower.
 */
const comparePreReleaseParts = (leftPart: string | undefined, rightPart: string | undefined): number => {
    if (leftPart === undefined) {
        return rightPart === undefined ? 0 : -1;
    }

    if (rightPart === undefined) {
        return 1;
    }

    const leftNumber = Number.parseInt(leftPart, 10);
    const rightNumber = Number.parseInt(rightPart, 10);
    const bothNumeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);

    return bothNumeric ? leftNumber - rightNumber : leftPart.localeCompare(rightPart);
};

const comparePreReleases = (left: string[], right: string[]): number => {
    // A version with no prerelease tag (e.g. 1.0.0) outranks one with a tag
    // (1.0.0-alpha.1), matching semver precedence.
    if (left.length === 0 && right.length > 0) {
        return 1;
    }

    if (left.length > 0 && right.length === 0) {
        return -1;
    }

    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
        const diff = comparePreReleaseParts(left[index], right[index]);

        if (diff !== 0) {
            return diff;
        }
    }

    return 0;
};

/**
 * Compare two semver-ish version strings (incl. `x.y.z-prerelease.N`). Returns
 * a negative number when `a < b`, zero when equal, positive when `a > b`. Good
 * enough for the alpha channel used here; it is not a full semver implementation
 * (no build metadata, no multi-identifier prerelease ordering beyond numeric).
 */
const compareVersions = (a: string, b: string): number => {
    const left = splitVersion(a);
    const right = splitVersion(b);

    for (let index = 0; index < 3; index += 1) {
        const diff = (left.core[index] ?? 0) - (right.core[index] ?? 0);

        if (diff !== 0) {
            return diff;
        }
    }

    return comparePreReleases(left.pre, right.pre);
};

/**
 * Warn (to stderr — never stdout, which is the JSON-RPC channel) when the
 * resolved vis CLI is older than {@link MIN_VIS_VERSION}. Non-fatal: a too-old
 * CLI still boots, but the operator gets an actionable hint instead of opaque
 * tool failures. Unparseable versions are skipped silently.
 */
const warnIfVisTooOld = (visVersion: string | undefined): void => {
    if (!visVersion || compareVersions(visVersion, MIN_VIS_VERSION) >= 0) {
        return;
    }

    process.stderr.write(
        `[vis-mcp] warning: @visulima/vis ${visVersion} is older than the required ${MIN_VIS_VERSION}; `
        + `lint/fmt/audit tools may fail with opaque errors. Upgrade @visulima/vis to >= ${MIN_VIS_VERSION}.\n`,
    );
};

/**
 * Resolve the user's installed `vis` CLI from a workspace root. Tries the
 * workspace's `node_modules` first (the install-time path used by consumers
 * of `@visulima/vis` + `@visulima/vis-mcp`), then falls back to `vis-mcp`'s
 * own install directory to pick up pnpm-workspace symlinks and peerDep
 * hoisting when the workspace root itself doesn't declare a direct dep on
 * vis. `VIS_MCP_VIS_BIN` short-circuits both for linked checkouts or
 * custom layouts where neither resolution succeeds.
 */
const resolveVisBin = (workspaceRoot: string): { binPath: string; version?: string } => {
    const override = process.env.VIS_MCP_VIS_BIN;

    if (override) {
        // An explicit override bypasses package resolution, so no version is
        // available to compatibility-check against.
        return { binPath: resolve(override) };
    }

    const candidates: { label: string; require: ReturnType<typeof createRequire> }[] = [
        { label: workspaceRoot, require: createRequire(pathToFileURL(`${workspaceRoot}/package.json`)) },
        { label: "vis-mcp install location", require: createRequire(import.meta.url) },
    ];

    const errors: { error: unknown; label: string }[] = [];
    let visPkgJsonPath: string | undefined;
    let visPkg: PackageJsonShape | undefined;

    for (const { label, require: request } of candidates) {
        try {
            visPkgJsonPath = request.resolve("@visulima/vis/package.json");
            visPkg = request("@visulima/vis/package.json") as PackageJsonShape;
            break;
        } catch (error) {
            errors.push({ error, label });
        }
    }

    if (!visPkgJsonPath || !visPkg) {
        const lastError = errors.at(-1)?.error;
        const tried = errors.map((entry) => entry.label).join(", ");

        throw new Error(`Cannot resolve \`@visulima/vis\` (tried: ${tried}). Install it as a workspace dependency, or set VIS_MCP_VIS_BIN to a vis CLI path.`, {
            cause: lastError,
        });
    }

    const binEntry = typeof visPkg.bin === "string" ? visPkg.bin : visPkg.bin?.vis;

    if (!binEntry) {
        throw new Error("`@visulima/vis` is installed but does not declare a `vis` bin entry — install a current version.");
    }

    return { binPath: resolve(dirname(visPkgJsonPath), binEntry), version: visPkg.version };
};

const loadVersion = async (): Promise<string> => {
    try {
        // findUp walks parents so this resolves the same way whether we're
        // running from `dist/bin.js` (production) or `src/server.ts` (vitest)
        // — both end up at the package root.
        const packageJsonPath = await findUp("package.json", { cwd: dirname(fileURLToPath(import.meta.url)) });

        if (!packageJsonPath) {
            return "0.0.0";
        }

        const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJsonShape;

        return parsed.version ?? "0.0.0";
    } catch (error) {
        process.stderr.write(`[vis-mcp] failed to read package.json: ${error instanceof Error ? error.message : String(error)}\n`);

        return "0.0.0";
    }
};

/**
 * Register every tool against an already-built MCP server. Pure wiring — no
 * I/O — so tests can drive it against an `InMemoryTransport` without forking
 * a subprocess.
 */
export const registerAllTools = (deps: ToolDeps, context: ToolContext): void => {
    registerListProjects(deps, context);
    registerDescribeProject(deps, context);
    registerListTargets(deps, context);
    registerListTemplates(deps, context);
    registerDescribeTemplate(deps, context);
    registerGetRunLogs(deps, context);
    registerListRuns(deps, context);
    registerCacheWhy(deps, context);
    registerCacheHash(deps, context);
    registerAudit(deps, context);
    registerAdvisoryStatus(deps, context);
    registerLint(deps, context);
    registerFmt(deps, context);
};

/**
 * Build a fully-configured MCP server with all vis tools registered. Returns
 * the server and deps so callers can connect any transport. Tests use this
 * with `InMemoryTransport.createLinkedPair()`.
 */
export const createMcpServer = async (context: ToolContext): Promise<{ deps: ToolDeps; server: McpServer }> => {
    const server = new McpServer({
        name: "vis",
        version: await loadVersion(),
    });

    const deps: ToolDeps = { server };

    registerAllTools(deps, context);

    return { deps, server };
};

/**
 * Boot the vis MCP server over stdio.
 *
 * Critical invariant: nothing in this process may write to stdout outside
 * the MCP transport. Any console.log in tool handlers will frame-corrupt
 * the JSON-RPC stream. Logs go to stderr only.
 */
export const startMcpServer = async (): Promise<void> => {
    const workspaceRoot = process.env.VIS_MCP_WORKSPACE_ROOT ?? process.cwd();
    const { binPath, version: visVersion } = resolveVisBin(workspaceRoot);

    warnIfVisTooOld(visVersion);

    const context: ToolContext = {
        visBin: binPath,
        workspaceRoot,
    };

    const { server } = await createMcpServer(context);

    await server.connect(new StdioServerTransport());

    process.stderr.write(`[vis-mcp] ready (workspace: ${context.workspaceRoot})\n`);
};

export { compareVersions, MIN_VIS_VERSION, warnIfVisTooOld };
