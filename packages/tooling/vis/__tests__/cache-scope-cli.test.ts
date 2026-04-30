import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheListExecute, cacheSizeExecute } from "../src/commands/cache/handler";
import { resetWorktreeCache } from "../src/git-worktree";

// When this test file runs inside a git pre-commit hook, git exports
// GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE pointing at the hook-running
// repo. Those leak into vitest workers and confuse `git worktree add`
// inside the temp fixture repos. Strip them so child `git` calls operate
// on the fixture's own `.git`.
for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
        delete process.env[key];
    }
}

const hasGit = (() => {
    try {
        execFileSync("git", ["--version"], { stdio: "ignore" });

        return true;
    } catch {
        return false;
    }
})();

const initRepo = (cwd: string): void => {
    execFileSync("git", ["init", "--initial-branch=main"], { cwd, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd, stdio: "ignore" });
    writeFileSync(join(cwd, "README.md"), "# test\n");
    execFileSync("git", ["add", "README.md"], { cwd, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
};

const seedEntry = (cacheDirectory: string, hash: string): void => {
    mkdirSync(join(cacheDirectory, hash), { recursive: true });
    writeFileSync(join(cacheDirectory, hash, "marker.txt"), `marker for ${hash}\n`);
};

const createMockLogger = (): { info: (message: string) => void; lines: string[] } => {
    const lines: string[] = [];

    return {
        info: (message: string) => lines.push(message),
        lines,
    };
};

interface CacheJsonPayload {
    directory: string;
    entries?: { hash: string }[];
    totalCount?: number;
}

const splitJsonObjects = (raw: string): CacheJsonPayload[] => {
    const objects: CacheJsonPayload[] = [];
    let depth = 0;
    let start = -1;

    for (let index = 0; index < raw.length; index += 1) {
        const ch = raw[index];

        if (ch === "{") {
            if (depth === 0) {
                start = index;
            }

            depth += 1;
        } else if (ch === "}") {
            depth -= 1;

            if (depth === 0 && start !== -1) {
                objects.push(JSON.parse(raw.slice(start, index + 1)) as CacheJsonPayload);
                start = -1;
            }
        }
    }

    return objects;
};

describe("cache --scope CLI dispatch", () => {
    let scratch: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    const originalEnv = process.env["VIS_CACHE_DIRECTORY"];

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-scope-cli-"));
        delete process.env["VIS_CACHE_DIRECTORY"];
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        resetWorktreeCache();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env["VIS_CACHE_DIRECTORY"];
        } else {
            process.env["VIS_CACHE_DIRECTORY"] = originalEnv;
        }

        stdoutSpy.mockRestore();
        resetWorktreeCache();

        if (existsSync(scratch)) {
            rmSync(scratch, { force: true, recursive: true });
        }
    });

    it("--scope=shared reads only the main worktree's cache from a linked checkout", async () => {
        expect.assertions(3);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        const sharedCache = resolve(main, ".task-runner-cache");
        const linkedCache = resolve(linked, ".task-runner-cache");

        seedEntry(sharedCache, "shared-only-hash");
        seedEntry(linkedCache, "linked-only-hash");

        try {
            const logger = createMockLogger();

            await cacheListExecute({
                argument: [],
                logger: logger as unknown as Console,
                options: { "cache-dir": undefined, format: "json", scope: "shared" },
                visConfig: undefined,
                workspaceRoot: linked,
            } as never);

            const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
            const payload = JSON.parse(written) as CacheJsonPayload;

            expect(payload.directory).toBe(sharedCache);
            expect(payload.entries?.map((entry) => entry.hash)).toContain("shared-only-hash");
            expect(payload.entries?.map((entry) => entry.hash)).not.toContain("linked-only-hash");
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("--scope=worktree reads only the linked checkout's local cache", async () => {
        expect.assertions(3);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        const sharedCache = resolve(main, ".task-runner-cache");
        const linkedCache = resolve(linked, ".task-runner-cache");

        seedEntry(sharedCache, "shared-only-hash");
        seedEntry(linkedCache, "linked-only-hash");

        try {
            const logger = createMockLogger();

            await cacheListExecute({
                argument: [],
                logger: logger as unknown as Console,
                options: { "cache-dir": undefined, format: "json", scope: "worktree" },
                visConfig: undefined,
                workspaceRoot: linked,
            } as never);

            const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
            const payload = JSON.parse(written) as CacheJsonPayload;

            expect(payload.directory).toBe(linkedCache);
            expect(payload.entries?.map((entry) => entry.hash)).toContain("linked-only-hash");
            expect(payload.entries?.map((entry) => entry.hash)).not.toContain("shared-only-hash");
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("--scope=all reads from both cache directories", async () => {
        expect.assertions(3);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        const sharedCache = resolve(main, ".task-runner-cache");
        const linkedCache = resolve(linked, ".task-runner-cache");

        seedEntry(sharedCache, "shared-only-hash");
        seedEntry(linkedCache, "linked-only-hash");

        try {
            const logger = createMockLogger();

            await cacheListExecute({
                argument: [],
                logger: logger as unknown as Console,
                options: { "cache-dir": undefined, format: "json", scope: "all" },
                visConfig: undefined,
                workspaceRoot: linked,
            } as never);

            // Two list payloads are emitted (one per directory) — concatenate
            // and pick them apart by braces.
            const written = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
            const payloads = splitJsonObjects(written);

            expect(payloads.map((p) => p.directory)).toStrictEqual([sharedCache, linkedCache]);
            expect(payloads[0]?.entries?.map((entry) => entry.hash)).toStrictEqual(["shared-only-hash"]);
            expect(payloads[1]?.entries?.map((entry) => entry.hash)).toStrictEqual(["linked-only-hash"]);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("--scope=all dedupes when shared and worktree resolve to the same path (primary checkout)", async () => {
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const sharedCache = resolve(main, ".task-runner-cache");

        seedEntry(sharedCache, "primary-hash");

        const logger = createMockLogger();

        await cacheSizeExecute({
            argument: [],
            logger: logger as unknown as Console,
            options: { "cache-dir": undefined, format: "json", scope: "all", type: "task" },
            visConfig: undefined,
            workspaceRoot: main,
        } as never);

        const written = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
        const payload = JSON.parse(written) as { task: { directory: string }[] };

        // Primary checkout: shared and worktree resolve to the same directory,
        // so only one task entry — no double-count.
        expect(payload.task).toHaveLength(1);
        expect(payload.task[0]?.directory).toBe(sharedCache);
    });

    it("falls back to 'shared' when an unknown --scope value is passed", async () => {
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        const sharedCache = resolve(main, ".task-runner-cache");

        seedEntry(sharedCache, "shared-only-hash");

        try {
            const logger = createMockLogger();

            await cacheListExecute({
                argument: [],
                logger: logger as unknown as Console,
                options: { "cache-dir": undefined, format: "json", scope: "bogus" },
                visConfig: undefined,
                workspaceRoot: linked,
            } as never);

            const written = (stdoutSpy.mock.calls.at(-1)?.[0] ?? "") as string;
            const payload = JSON.parse(written) as CacheJsonPayload;

            // Unknown scope → defaults to 'shared'.
            expect(payload.directory).toBe(sharedCache);
            expect(payload.entries?.map((entry) => entry.hash)).toContain("shared-only-hash");
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });
});
