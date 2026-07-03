import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAdapter, detectPackageManager } from "../../../src/release/core/package-managers/detect";
import { MockRunner } from "../../../src/release/core/shell-runner";

const writePkg = (dir: string, pkg: Record<string, unknown>): void => {
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
};

const writeLockfile = (dir: string, name: string): void => {
    writeFileSync(join(dir, name), "");
};

describe("detectPackageManager — Corepack packageManager field", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-pm-detect-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("detects pnpm from packageManager field", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "pnpm@10.0.0" });
        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("pnpm");
    });

    it("detects yarn from packageManager field", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "yarn@4.5.0" });
        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("yarn");
    });

    it("detects bun from packageManager field", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "bun@1.1.36" });
        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("bun");
    });

    it("detects npm from packageManager field", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "npm@11.0.0" });
        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("npm");
    });

    it("handles packageManager value without `@` suffix", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "pnpm" });
        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("pnpm");
    });

    it("corepack hint wins over lockfile presence", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "yarn@4.5.0" });
        writeLockfile(cwd, "pnpm-lock.yaml");

        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("yarn");
    });

    it("falls through to lockfile when packageManager value is unrecognised", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x", packageManager: "deno@1.0.0" });
        writeLockfile(cwd, "pnpm-lock.yaml");

        const result = await detectPackageManager(cwd, new MockRunner());

        expect(result).toBe("pnpm");
    });
});

describe("detectPackageManager — lockfile resolution", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-pm-detect-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("detects bun via bun.lock", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });
        writeLockfile(cwd, "bun.lock");

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("bun");
    });

    it("detects bun via bun.lockb", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });
        writeLockfile(cwd, "bun.lockb");

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("bun");
    });

    it("detects pnpm via pnpm-lock.yaml", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });
        writeLockfile(cwd, "pnpm-lock.yaml");

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("pnpm");
    });

    it("detects yarn via yarn.lock", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });
        writeLockfile(cwd, "yarn.lock");

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("yarn");
    });

    it("falls back to npm when no lockfile is present", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("npm");
    });

    it("falls back to npm when package.json is missing", async () => {
        expect.hasAssertions();
        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("npm");
    });

    it("bun lockfile wins over pnpm + yarn lockfiles", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });
        writeLockfile(cwd, "bun.lock");
        writeLockfile(cwd, "pnpm-lock.yaml");
        writeLockfile(cwd, "yarn.lock");

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("bun");
    });

    it("pnpm lockfile wins over yarn lockfile", async () => {
        expect.hasAssertions();

        writePkg(cwd, { name: "x" });
        writeLockfile(cwd, "pnpm-lock.yaml");
        writeLockfile(cwd, "yarn.lock");

        await expect(detectPackageManager(cwd, new MockRunner())).resolves.toBe("pnpm");
    });
});

describe(createAdapter, () => {
    it("returns NpmAdapter for npm", () => {
        expect.hasAssertions();

        const adapter = createAdapter("npm", new MockRunner());

        expect(adapter.id).toBe("npm");
    });

    it("returns PnpmAdapter for pnpm", () => {
        expect.hasAssertions();

        const adapter = createAdapter("pnpm", new MockRunner());

        expect(adapter.id).toBe("pnpm");
    });

    it("returns YarnAdapter for yarn", () => {
        expect.hasAssertions();

        const adapter = createAdapter("yarn", new MockRunner());

        expect(adapter.id).toBe("yarn");
    });

    it("returns BunAdapter for bun", () => {
        expect.hasAssertions();

        const adapter = createAdapter("bun", new MockRunner());

        expect(adapter.id).toBe("bun");
    });
});
