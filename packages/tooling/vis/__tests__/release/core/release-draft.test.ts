import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { releaseDraft } from "../../../src/release/api";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const setupFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-draft-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });
    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n  - 'packages/*/*'\n");
    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", version: "1.0.0" });
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
    writeFileSync(join(cwd, ".vis", "release", "change.md"), `---\n"@scope/a": minor\n---\nAdd a feature.\n`);

    return cwd;
};

const readVersion = (cwd: string): string => (JSON.parse(readFileSync(join(cwd, "packages", "a", "package.json"), "utf8")) as { version: string }).version;

const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("release: releaseDraft", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("exposes the computed plan without applying it", async () => {
        expect.hasAssertions();

        const draft = await releaseDraft({ config: { acknowledgeUnstable: true, defaultManaged: true }, cwd, firstRelease: true });

        expect(draft.plan.releases.map((r) => `${r.name}@${r.newVersion}`)).toContain("@scope/a@1.1.0");
        // Not applied yet — disk is untouched.
        expect(readVersion(cwd)).toBe("1.0.0");

        draft.discard();
    });

    it("apply() writes the new version and is idempotent", async () => {
        expect.hasAssertions();

        const draft = await releaseDraft({ config: { acknowledgeUnstable: true, defaultManaged: true }, cwd, firstRelease: true });
        const first = await draft.apply();
        const second = await draft.apply();

        expect(readVersion(cwd)).toBe("1.1.0");
        expect(second).toBe(first);
    });

    it("auto-applies on `await using` scope exit", async () => {
        expect.hasAssertions();

        {
            await using draft = await releaseDraft({ config: { acknowledgeUnstable: true, defaultManaged: true }, cwd, firstRelease: true });

            // Plan is visible before the scope exits; the version is not yet applied.
            expect(draft.plan.releases.map((r) => r.name)).toContain("@scope/a");
            expect(readVersion(cwd)).toBe("1.0.0");
        }

        expect(readVersion(cwd)).toBe("1.1.0");
    });

    it("discard() prevents auto-apply on disposal", async () => {
        expect.hasAssertions();

        {
            await using draft = await releaseDraft({ config: { acknowledgeUnstable: true, defaultManaged: true }, cwd, firstRelease: true });

            draft.discard();
        }

        expect(readVersion(cwd)).toBe("1.0.0");
    });
});
