import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import syncExecute from "../../../src/commands/sync/handler";
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
            debug: (...args) => calls.push(["debug", ...args]),
            error: (...args) => calls.push(["error", ...args]),
            info: (...args) => calls.push(["info", ...args]),
            warn: (...args) => calls.push(["warn", ...args]),
        },
    };
};

describe("vis sync codeowners", () => {
    let workspaceRoot: string;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-sync-");
        originalExitCode = process.exitCode;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const aDir = join(workspaceRoot, "packages", "a");

        mkdirSync(aDir, { recursive: true });
        writeFileSync(join(aDir, "package.json"), JSON.stringify({ name: "@my/a" }));
        writeFileSync(
            join(aDir, "project.json"),
            JSON.stringify({
                owners: [{ owners: ["@team-a"], path: "src/**" }],
            }),
        );
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
        process.exitCode = originalExitCode;
    });

    it("throws when the kind argument is missing", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            syncExecute({
                argument: [],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing sync kind/);
    });

    it("throws on an unknown kind", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(
            syncExecute({
                argument: ["wat"],
                logger,
                options: {},
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Unknown sync kind/);
    });

    it("writes a CODEOWNERS file with each project's owners", async () => {
        expect.assertions(2);

        const { logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const content = readFileSync(join(workspaceRoot, "CODEOWNERS"), "utf8");

        expect(content).toContain("/packages/a/src/**");
        expect(content).toContain("@team-a");
    });

    it("writes to a custom --out path when provided", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: { out: ".github/CODEOWNERS" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const content = readFileSync(join(workspaceRoot, ".github/CODEOWNERS"), "utf8");

        expect(content).toContain("/packages/a/src/**");
    });

    it("--check sets process.exitCode=1 when the file is stale", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        writeFileSync(join(workspaceRoot, "CODEOWNERS"), "outdated content\n");

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: { check: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(process.exitCode).toBe(1);
        expect(text).toContain("out of date");

        process.exitCode = 0;
    });

    it("--check is a no-op when the file is up to date", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const beforeChecks = process.exitCode;

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: { check: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(process.exitCode).toBe(beforeChecks);
        expect(text).toContain("is up to date");
    });

    it("logs 'Nothing to sync' when no project declares owners", async () => {
        expect.assertions(1);

        // Replace project.json with one that has no owners
        const aDir = join(workspaceRoot, "packages", "a");

        writeFileSync(join(aDir, "project.json"), JSON.stringify({}));

        const { calls, logger } = makeLogger();

        await syncExecute({
            argument: ["codeowners"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Nothing to sync");
    });
});

describe("vis sync package-json-fields", () => {
    let workspaceRoot: string;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-sync-pkg-");
        originalExitCode = process.exitCode;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(
            join(workspaceRoot, "package.json"),
            JSON.stringify(
                {
                    author: "Alice <alice@example.com>",
                    bugs: { url: "https://example.com/issues" },
                    engines: { node: ">=22" },
                    homepage: "https://example.com",
                    license: "MIT",
                    name: "root",
                    repository: { directory: "", type: "git", url: "https://github.com/example/repo.git" },
                },
                null,
                4,
            ),
        );
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
        process.exitCode = originalExitCode;
    });

    const writePackage = (name: string, body: Record<string, unknown>): string => {
        const dir = join(workspaceRoot, "packages", name);

        mkdirSync(dir, { recursive: true });
        const filePath = join(dir, "package.json");

        writeFileSync(filePath, JSON.stringify(body, null, 4));

        return filePath;
    };

    it("mirrors drifted fields from root onto a workspace package", async () => {
        expect.assertions(3);

        const filePath = writePackage("a", { license: "ISC", name: "@my/a" });
        const { logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

        expect(written.license).toBe("MIT");
        expect(written.author).toBe("Alice <alice@example.com>");
        expect(written.engines).toStrictEqual({ node: ">=22" });
    });

    it("--check sets process.exitCode=1 when a package drifts", async () => {
        expect.assertions(3);

        writePackage("a", { license: "ISC", name: "@my/a" });
        const { calls, logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { check: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(process.exitCode).toBe(1);
        expect(text).toContain("license drifts from root");
        expect(text).toContain("Found");

        process.exitCode = 0;
    });

    it("--check is a no-op when every package is in sync", async () => {
        expect.assertions(2);

        writePackage("a", {
            author: "Alice <alice@example.com>",
            bugs: { url: "https://example.com/issues" },
            engines: { node: ">=22" },
            homepage: "https://example.com",
            license: "MIT",
            name: "@my/a",
            repository: { directory: "packages/a", type: "git", url: "https://github.com/example/repo.git" },
        });

        const { calls, logger } = makeLogger();
        const beforeExit = process.exitCode;

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { check: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(process.exitCode).toBe(beforeExit);
        expect(text).toContain("in sync");
    });

    it("--fields scopes the run to the named fields and ignores others", async () => {
        expect.assertions(2);

        const filePath = writePackage("a", { author: "Bob", license: "ISC", name: "@my/a" });
        const { logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { fields: ["license"] },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

        expect(written.license).toBe("MIT");
        expect(written.author).toBe("Bob");
    });

    it("--fields accepts a single comma-separated value", async () => {
        expect.assertions(2);

        const filePath = writePackage("a", { author: "Bob", license: "ISC", name: "@my/a" });
        const { logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { fields: ["license,author"] },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

        expect(written.license).toBe("MIT");
        expect(written.author).toBe("Alice <alice@example.com>");
    });

    it("--ignore-package-name skips packages whose name matches the glob", async () => {
        expect.assertions(2);

        const skippedPath = writePackage("legacy", { license: "ISC", name: "@my/legacy" });
        const syncedPath = writePackage("modern", { license: "ISC", name: "@my/modern" });
        const { logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { ignorePackageName: ["@my/legacy"] },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const skipped = JSON.parse(readFileSync(skippedPath, "utf8")) as Record<string, unknown>;
        const synced = JSON.parse(readFileSync(syncedPath, "utf8")) as Record<string, unknown>;

        expect(skipped.license).toBe("ISC");
        expect(synced.license).toBe("MIT");
    });

    it("preserves repository.directory on the destination package", async () => {
        expect.assertions(1);

        const filePath = writePackage("a", {
            name: "@my/a",
            repository: { directory: "packages/a", type: "git", url: "https://github.com/old/repo.git" },
        });

        const { logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { fields: ["repository"] },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

        expect(written.repository).toStrictEqual({
            directory: "packages/a",
            type: "git",
            url: "https://github.com/example/repo.git",
        });
    });

    it("--format json emits the structured report on stdout", async () => {
        expect.assertions(4);

        writePackage("a", { license: "ISC", name: "@my/a" });
        const { logger } = makeLogger();

        const original = process.stdout.write.bind(process.stdout);
        let captured = "";

        process.stdout.write = (chunk: string | Uint8Array): boolean => {
            captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

            return true;
        };

        try {
            await syncExecute({
                argument: ["package-json-fields"],
                logger,
                options: { format: "json" },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);
        } finally {
            process.stdout.write = original;
        }

        const payload = JSON.parse(captured) as {
            changes: { field: string; packageJsonPath: string; packageName: string }[];
            kind: string;
            mode: string;
            totalChanges: number;
        };

        expect(payload.kind).toBe("package-json-fields");
        expect(payload.mode).toBe("write");
        expect(payload.totalChanges).toBeGreaterThanOrEqual(1);
        expect(payload.changes.find((change) => change.field === "license")).toMatchObject({
            packageJsonPath: "packages/a/package.json",
            packageName: "@my/a",
        });
    });

    it("--quiet suppresses per-package log lines but keeps the summary", async () => {
        expect.assertions(2);

        writePackage("a", { license: "ISC", name: "@my/a" });
        const { calls, logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { quiet: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).not.toContain("packages/a/package.json: synced");
        expect(text).toContain("Synced");
    });

    it("does not delete fields that are missing on root", async () => {
        expect.assertions(1);

        // Drop `funding` from root (already absent in beforeEach), keep it on package.
        const filePath = writePackage("a", { funding: "https://github.com/sponsors/me", name: "@my/a" });

        const { logger } = makeLogger();

        await syncExecute({
            argument: ["package-json-fields"],
            logger,
            options: { fields: ["funding"] },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const written = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

        expect(written.funding).toBe("https://github.com/sponsors/me");
    });
});
