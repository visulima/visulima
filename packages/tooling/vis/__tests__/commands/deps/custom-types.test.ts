import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import lintExecute from "../../../src/commands/deps/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

type LoggerCall = [string, ...unknown[]];

const makeLogger = (): {
    calls: LoggerCall[];
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    const calls: LoggerCall[] = [];

    return {
        calls,
        logger: {
            debug: (...arguments_) => calls.push(["debug", ...arguments_]),
            error: (...arguments_) => calls.push(["error", ...arguments_]),
            info: (...arguments_) => calls.push(["info", ...arguments_]),
            warn: (...arguments_) => calls.push(["warn", ...arguments_]),
        },
    };
};

const writePackage = (root: string, relativePath: string, json: unknown): void => {
    const directory = join(root, relativePath);

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), `${JSON.stringify(json, undefined, 2)}\n`);
};

const DEFAULT_ROOT_JSON = { name: "root", workspaces: ["packages/*"] };

const writeWorkspaceRoot = (root: string, json: unknown = DEFAULT_ROOT_JSON): void => {
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(root, "package.json"), `${JSON.stringify(json, undefined, 2)}\n`);
};

const callLint = async (workspaceRoot: string, options: Record<string, unknown>, visConfig?: unknown): Promise<{ calls: LoggerCall[] }> => {
    const { calls, logger } = makeLogger();

    await lintExecute({
        argument: [],
        logger,
        options,
        runtime: {} as never,
        visConfig: visConfig as never,
        workspaceRoot,
    } as never);

    return { calls };
};

describe("vis lint --custom-types", () => {
    let workspaceRoot: string;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-lint-custom-types-");
        originalExitCode = process.exitCode;
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
        process.exitCode = originalExitCode;
    });

    it("flags engines.node drift and reports a non-zero exit code", async () => {
        expect.assertions(1);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        await callLint(workspaceRoot, { "custom-types": true });

        expect(process.exitCode).toBe(1);
    });

    it("auto-fixes drift to the highest version when --fix is passed", async () => {
        expect.assertions(2);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        await callLint(workspaceRoot, { "custom-types": true, fix: true });

        const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

        expect(after.engines.node).toBe("22.14.0");
        // Fix succeeded → exit code stays clean.
        expect(process.exitCode).toBeUndefined();
    });

    it("does NOT rewrite when policy.customTypes.autofix === false (still fails CI)", async () => {
        expect.assertions(3);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const { calls } = await callLint(workspaceRoot, { "custom-types": true, fix: true }, { policy: { customTypes: { autofix: false } } });

        const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

        expect(after.engines.node).toBe("20.0.0");
        expect(process.exitCode).toBe(1);
        expect(calls.some(([level, message]) => level === "warn" && typeof message === "string" && message.includes("autofix = false"))).toBe(true);
    });

    it("strips the +sha512 hash on packageManager bump", async () => {
        expect.assertions(2);

        writeWorkspaceRoot(workspaceRoot, {
            name: "root",
            packageManager: "pnpm@9.0.0+sha512.outdated",
            workspaces: ["packages/*"],
        });
        writePackage(workspaceRoot, "packages/a", { name: "@my/a", packageManager: "pnpm@10.32.1+sha512.fresh" });

        await callLint(workspaceRoot, { "custom-types": true, fix: true });

        const root = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8"));

        expect(root.packageManager).toContain("pnpm@10.32.1");
        // Hash dropped — content-integrity hashes are tied to the specific package.
        expect(root.packageManager).not.toContain("+sha512");
    });

    it("respects --dep node to filter to a single dep", async () => {
        expect.assertions(2);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0", pnpm: "10.0.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0", pnpm: "9.0.0" }, name: "@my/b" });

        await callLint(workspaceRoot, { "custom-types": true, dep: "node", fix: true });

        const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

        // node was fixed.
        expect(after.engines.node).toBe("22.14.0");
        // pnpm was excluded by --dep, so the drift survives.
        expect(after.engines.pnpm).toBe("9.0.0");
    });

    it("treats policy.customTypes.autofix === \"prompt\" as report-only", async () => {
        expect.assertions(3);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const { calls } = await callLint(workspaceRoot, { "custom-types": true, fix: true }, { policy: { customTypes: { autofix: "prompt" } } });

        const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

        expect(after.engines.node).toBe("20.0.0");
        expect(process.exitCode).toBe(1);
        expect(calls.some(([level, message]) => level === "warn" && typeof message === "string" && message.includes("not yet implemented"))).toBe(true);
    });

    it("fixes engines.node and volta.node drift in the same file with a single write", async () => {
        expect.assertions(2);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a", volta: { node: "22.14.0" } });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b", volta: { node: "20.0.0" } });

        await callLint(workspaceRoot, { "custom-types": true, fix: true });

        const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

        // Both clusters fixed in one pass — byFile grouping wrote once.
        expect(after.engines.node).toBe("22.14.0");
        expect(after.volta.node).toBe("22.14.0");
    });

    it("emits each JSON issue with depName, customType, fix, specifier, and workspace-relative packageJsonPath", async () => {
        expect.assertions(7);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const writes: string[] = [];
        const originalWrite = process.stdout.write.bind(process.stdout);

        (process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean => {
            writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

            return true;
        };

        try {
            await callLint(workspaceRoot, { "custom-types": true, format: "json" });
        } finally {
            process.stdout.write = originalWrite;
        }

        const payload = JSON.parse(writes.join(""));
        const issue = payload.customTypes.issues[0];

        // Lock down the shape that editor/CI consumers rely on.
        expect(issue.customType).toBe("engines");
        expect(issue.depName).toBe("node");
        expect(issue.specifier).toBe("20.0.0");
        expect(issue.fix).toBe("22.14.0");
        expect(issue.packageName).toBe("@my/b");
        // Path must be workspace-relative, not absolute (CI portability).
        expect(issue.packageJsonPath).toBe("packages/b/package.json");
        expect(issue.canonicalSource).toBe("@my/a");
    });

    it("emits a tab-separated `custom-types` line per issue in --format minimal", async () => {
        expect.assertions(2);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const writes: string[] = [];
        const originalWrite = process.stdout.write.bind(process.stdout);

        (process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean => {
            writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

            return true;
        };

        try {
            await callLint(workspaceRoot, { "custom-types": true, format: "minimal" });
        } finally {
            process.stdout.write = originalWrite;
        }

        const lines = writes.join("").split("\n").filter(Boolean);
        const customTypesLine = lines.find((line) => line.startsWith("custom-types\t"));

        expect(customTypesLine).toBeDefined();
        // Field order: rule\tpath\tcustomType\tdepName\t<specifier> → <fix>
        expect(customTypesLine).toBe("custom-types\tpackages/b/package.json\tengines\tnode\t20.0.0 → 22.14.0");
    });

    it("emits a human-readable section grouped by `engines node` heading", async () => {
        expect.assertions(3);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const { calls } = await callLint(workspaceRoot, { "custom-types": true });

        // Strip ANSI colours so assertions don't depend on TTY detection.
        // eslint-disable-next-line no-control-regex
        const ansi = /\[[0-9;]*m/g;
        const messages = calls.filter(([level]) => level === "info").map(([, message]) => String(message).replaceAll(ansi, ""));

        expect(messages.some((message) => message.includes("Found 1 custom-type drift"))).toBe(true);
        // Heading uses the `${customType} ${depName}` form to keep engines vs volta distinct.
        expect(messages.some((message) => message.includes("engines node") && message.includes("canonical: 22.14.0"))).toBe(true);
        // Per-package row shows old → new and includes the package name.
        expect(messages.some((message) => message.includes("@my/b") && message.includes("20.0.0") && message.includes("22.14.0"))).toBe(true);
    });

    it("rejects malformed policy.customTypes.extraTypes with non-zero exit and aborts before iterating packages", async () => {
        expect.assertions(4);

        writeWorkspaceRoot(workspaceRoot);
        // Real drift the run would otherwise surface — proves we aborted *before*
        // touching the workspace, not just suppressed the output.
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const { calls } = await callLint(
            workspaceRoot,
            { "custom-types": true },
            {
                policy: {
                    customTypes: {
                        extraTypes: [
                            // strategy 'string' requires depName — missing on purpose.
                            { name: "minNode", path: "config.minNode", strategy: "string" },
                            // collides with the built-in `engines` family.
                            { name: "engines", path: "wherever", strategy: "versionsByName" },
                        ],
                    },
                },
            },
        );

        const errors = calls.filter(([level]) => level === "error").map(([, message]) => String(message));

        expect(process.exitCode).toBe(1);
        expect(errors.some((message) => message.includes("strategy 'string' requires 'depName'"))).toBe(true);
        expect(errors.some((message) => message.includes("collides with a built-in"))).toBe(true);
        // No drift line was emitted because we returned before lintCustomTypes ran.
        expect(errors.some((message) => message.includes("@my/b") || message.includes("drift"))).toBe(false);
    });

    it("emits JSON output containing the customTypes section with a fixed flag", async () => {
        expect.assertions(2);

        writeWorkspaceRoot(workspaceRoot);
        writePackage(workspaceRoot, "packages/a", { engines: { node: "22.14.0" }, name: "@my/a" });
        writePackage(workspaceRoot, "packages/b", { engines: { node: "20.0.0" }, name: "@my/b" });

        const writes: string[] = [];
        const originalWrite = process.stdout.write.bind(process.stdout);

        (process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean => {
            writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

            return true;
        };

        try {
            await callLint(workspaceRoot, { "custom-types": true, format: "json" });
        } finally {
            process.stdout.write = originalWrite;
        }

        const payload = JSON.parse(writes.join(""));

        expect(payload.customTypes.total).toBe(1);
        expect(payload.fixed.customTypes).toBe(false);
    });
});
