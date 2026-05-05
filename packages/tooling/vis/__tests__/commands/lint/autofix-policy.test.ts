import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import lintExecute from "../../../src/commands/lint/handler";
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

const DEFAULT_WORKSPACE_PACKAGE_JSON = { name: "root", workspaces: ["packages/*"] };

const writeWorkspaceRoot = (root: string, json: unknown = DEFAULT_WORKSPACE_PACKAGE_JSON): void => {
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

describe("vis lint autofix opt-out (item 16)", () => {
    let workspaceRoot: string;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-lint-autofix-");
        originalExitCode = process.exitCode;
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
        process.exitCode = originalExitCode;
    });

    describe("workspace-protocol", () => {
        it("rewrites internal deps when policy.workspaceProtocol.autofix is undefined (default true)", async () => {
            expect.assertions(2);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { name: "@my/a", version: "1.0.0" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { "@my/a": "^1.0.0" }, name: "@my/b" });

            await callLint(workspaceRoot, { fix: true, "workspace-protocol": true });

            const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            expect(after.dependencies["@my/a"]).toBe("workspace:*");
            // Fix happened — exit code stays clean.
            expect(process.exitCode).toBeUndefined();
        });

        it("does NOT rewrite when policy.workspaceProtocol.autofix === false (still fails CI)", async () => {
            expect.assertions(3);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { name: "@my/a", version: "1.0.0" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { "@my/a": "^1.0.0" }, name: "@my/b" });

            const { calls } = await callLint(workspaceRoot, { fix: true, "workspace-protocol": true }, { policy: { workspaceProtocol: { autofix: false } } });

            const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            // The original specifier survives.
            expect(after.dependencies["@my/a"]).toBe("^1.0.0");
            // Issue still counted toward CI failure.
            expect(process.exitCode).toBe(1);
            // User is told why nothing was rewritten.
            expect(calls.some(([level, message]) => level === "warn" && typeof message === "string" && message.includes("autofix = false"))).toBe(true);
        });

        it("treats policy.workspaceProtocol.autofix === \"prompt\" as report-only (interactive deferred)", async () => {
            expect.assertions(3);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { name: "@my/a", version: "1.0.0" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { "@my/a": "^1.0.0" }, name: "@my/b" });

            const { calls } = await callLint(
                workspaceRoot,
                { fix: true, "workspace-protocol": true },
                { policy: { workspaceProtocol: { autofix: "prompt" } } },
            );

            const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            expect(after.dependencies["@my/a"]).toBe("^1.0.0");
            expect(process.exitCode).toBe(1);
            expect(calls.some(([level, message]) => level === "warn" && typeof message === "string" && message.includes("not yet implemented"))).toBe(true);
        });
    });

    describe("workspace-versions", () => {
        it("does NOT rewrite drifting deps when policy.workspaceVersions.autofix === false", async () => {
            expect.assertions(2);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { dependencies: { react: "^18.0.0" }, name: "@my/a" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { react: "^18.2.0" }, name: "@my/b" });

            await callLint(workspaceRoot, { fix: true, "workspace-versions": true }, { policy: { workspaceVersions: { autofix: false } } });

            const a = JSON.parse(readFileSync(join(workspaceRoot, "packages/a/package.json"), "utf8"));
            const b = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            expect(a.dependencies.react).toBe("^18.0.0");
            expect(b.dependencies.react).toBe("^18.2.0");
        });

        it("rewrites drift when policy.workspaceVersions.autofix is true (default)", async () => {
            expect.assertions(2);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { dependencies: { react: "^18.0.0" }, name: "@my/a" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { react: "^18.2.0" }, name: "@my/b" });

            await callLint(workspaceRoot, { fix: true, "workspace-versions": true });

            const a = JSON.parse(readFileSync(join(workspaceRoot, "packages/a/package.json"), "utf8"));
            const b = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            // Highest is the default resolution, so both align to ^18.2.0.
            expect(a.dependencies.react).toBe("^18.2.0");
            expect(b.dependencies.react).toBe("^18.2.0");
        });

        it("explicit autofix: true behaves identically to undefined", async () => {
            expect.assertions(1);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { dependencies: { react: "^18.0.0" }, name: "@my/a" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { react: "^18.2.0" }, name: "@my/b" });

            await callLint(workspaceRoot, { fix: true, "workspace-versions": true }, { policy: { workspaceVersions: { autofix: true } } });

            const a = JSON.parse(readFileSync(join(workspaceRoot, "packages/a/package.json"), "utf8"));

            expect(a.dependencies.react).toBe("^18.2.0");
        });

        it("does not warn when --fix is omitted, even with autofix: false (no rewrite was attempted)", async () => {
            expect.assertions(1);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { dependencies: { react: "^18.0.0" }, name: "@my/a" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { react: "^18.2.0" }, name: "@my/b" });

            const { calls } = await callLint(workspaceRoot, { "workspace-versions": true }, { policy: { workspaceVersions: { autofix: false } } });

            // The "not rewritten" warn is only relevant when --fix was actually passed.
            expect(calls.some(([level, message]) => level === "warn" && typeof message === "string" && message.includes("not rewritten"))).toBe(false);
        });
    });

    describe("jSON output reflects per-rule fix state", () => {
        it("emits fixed: { workspaceProtocol: false, ... } when policy denied the rewrite", async () => {
            expect.assertions(3);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { name: "@my/a", version: "1.0.0" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { "@my/a": "^1.0.0" }, name: "@my/b" });

            const writes: string[] = [];
            const originalWrite = process.stdout.write.bind(process.stdout);

            (process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean => {
                writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

                return true;
            };

            try {
                await callLint(workspaceRoot, { fix: true, format: "json", "workspace-protocol": true }, { policy: { workspaceProtocol: { autofix: false } } });
            } finally {
                process.stdout.write = originalWrite;
            }

            const payload = JSON.parse(writes.join(""));

            expect(payload.fixed).toStrictEqual({ catalogProposals: false, customTypes: false, workspaceProtocol: false, workspaceVersions: false });
            // Sanity: the issue is still present in the report.
            expect(payload.workspaceProtocol.total).toBe(1);

            // The package.json was not rewritten.
            const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            expect(after.dependencies["@my/a"]).toBe("^1.0.0");
        });
    });

    describe("mixed selection — protocol allowed, versions denied", () => {
        it("rewrites protocol drift but leaves version drift alone", async () => {
            expect.assertions(4);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", {
                dependencies: { react: "^18.0.0" },
                name: "@my/a",
                version: "1.0.0",
            });
            writePackage(workspaceRoot, "packages/b", {
                dependencies: { "@my/a": "^1.0.0", react: "^18.2.0" },
                name: "@my/b",
            });

            const { calls } = await callLint(
                workspaceRoot,
                { fix: true, "workspace-protocol": true, "workspace-versions": true },
                { policy: { workspaceVersions: { autofix: false } } },
            );

            const a = JSON.parse(readFileSync(join(workspaceRoot, "packages/a/package.json"), "utf8"));
            const b = JSON.parse(readFileSync(join(workspaceRoot, "packages/b/package.json"), "utf8"));

            // Protocol fix did happen.
            expect(b.dependencies["@my/a"]).toBe("workspace:*");
            // Version drift was left alone.
            expect(a.dependencies.react).toBe("^18.0.0");
            expect(b.dependencies.react).toBe("^18.2.0");

            // Only the workspace-versions warn fires, not the workspace-protocol one.
            const warns = calls.filter(([level]) => level === "warn").map(([, message]) => String(message));

            expect(warns.some((message) => message.includes("workspace-versions:") && message.includes("not rewritten"))).toBe(true);
        });
    });

    describe("catalog proposals respect workspace-versions autofix policy", () => {
        it("does not rewrite pnpm-workspace.yaml when policy denies autofix, but still reports proposals", async () => {
            expect.assertions(2);

            writeWorkspaceRoot(workspaceRoot);
            writePackage(workspaceRoot, "packages/a", { dependencies: { react: "^18.2.0" }, name: "@my/a" });
            writePackage(workspaceRoot, "packages/b", { dependencies: { react: "^18.2.0" }, name: "@my/b" });

            await callLint(
                workspaceRoot,
                { fix: true, "propose-min": 2, resolve: "catalog", "workspace-versions": true },
                { policy: { workspaceVersions: { autofix: false } } },
            );

            const yaml = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

            // pnpm-workspace.yaml not touched.
            expect(yaml).not.toContain("catalog:");
            expect(yaml).not.toContain("react");
        });
    });
});
