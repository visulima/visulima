/**
 * Regression tests for issue #862 — `vis release init --from-semantic-release
 * --apply` used to perform a full cutover (delete every `.releaserc.*`, mark
 * every manifest managed) while the dry-run promised a per-package opt-in.
 *
 * The contract these lock in:
 *   - plain `--apply` is non-destructive: scaffold + ignore files + the
 *     `vis.config.ts` release block, nothing else;
 *   - `--cutover` is the explicit opt-in for the destructive writes, and its
 *     generated config says `defaultManaged: true`;
 *   - `--packages a,b` routes the manifest opt-in through a selection;
 *   - `--dry-run` previews exactly the run the same flags would perform.
 *
 * The last five describes cover the CodeRabbit review of PR #867, which found
 * five more ways the same run could destroy something it did not promise to
 * touch: a release config that only *looks* declared, a symlink that walks the
 * cutover out of the workspace, a run that half-writes without `--apply`, an
 * unreadable file mistaken for an absent one, and an ignore rule shadowed by a
 * comment.
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import initHandler from "../../../src/commands/release/init/handler";

/**
 * Stand-in for the readline confirm prompt. `answer` decides per question, so
 * a test can accept the cutover while still declining the workflow-generation
 * prompt that follows it.
 */
const prompts = vi.hoisted(() => {
    return {
        answer: (_question: string): boolean => false,
        questions: [] as string[],
    };
});

vi.mock(import("../../../src/release/core/prompts"), () => {
    return {
        confirmPrompt: async (question: string): Promise<boolean> => {
            prompts.questions.push(question);

            return prompts.answer(question);
        },
    };
});

const originalIsTty = process.stdout.isTTY;

/** `process.stdout.isTTY` is a plain property, so the interactivity probe is toggled by hand. */
const setTty = (value: boolean | undefined): void => {
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value });
};

/** The real `node:fs/promises` in the shape cerebro injects as `toolbox.fs`. */
const testFs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

const writeJson = (path: string, value: unknown, indent: number = 4): void => {
    writeFileSync(path, `${JSON.stringify(value, null, indent)}\n`);
};

/** Two publishable packages, each with its own `.releaserc.json`. */
const setupFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-release-init-"));

    writeJson(join(cwd, "package.json"), { name: "fixture-root", private: true, version: "0.0.0" });
    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

    for (const name of ["a", "b"]) {
        const dir = join(cwd, "packages", name);

        mkdirSync(dir, { recursive: true });
        writeJson(join(dir, "package.json"), { name: `@scope/${name}`, version: "1.0.0" });
        writeJson(join(dir, ".releaserc.json"), {
            branches: ["main", { name: "alpha", prerelease: true }],
            extends: "@anolilab/semantic-release-preset/pnpm",
        });
    }

    return cwd;
};

interface Captured {
    errors: string[];
    infos: string[];
    out: string;
    warns: string[];
}

const runInit = async (cwd: string, options: Record<string, unknown>): Promise<Captured> => {
    const infos: string[] = [];
    const warns: string[] = [];
    const errors: string[] = [];

    const logger = {
        error: (message: string) => errors.push(message),
        info: (message: string) => infos.push(message),
        warn: (message: string) => warns.push(message),
    };

    await initHandler({ fs: testFs, logger, options: { fromSemanticRelease: true, ...options }, workspaceRoot: cwd });

    return { errors, infos, out: infos.join("\n"), warns };
};

const readManifest = async (cwd: string, name: string): Promise<Record<string, unknown>> =>
    JSON.parse(await readFile(join(cwd, "packages", name, "package.json"), "utf8")) as Record<string, unknown>;

const rcPath = (cwd: string, name: string): string => join(cwd, "packages", name, ".releaserc.json");

/** A throwaway directory outside the fixture workspace, cleaned up by the caller. */
const makeOutsideDir = (): string => mkdtempSync(join(tmpdir(), "vis-release-outside-"));

/**
 * `true` when `chmod` actually denies a read on this platform and for this
 * user. Windows ignores the mode bits and root walks straight past them, so
 * the permission-failure tests only mean something where this holds.
 */
const chmodDeniesReads = (): boolean => {
    const directory = mkdtempSync(join(tmpdir(), "vis-release-chmod-"));
    const probe = join(directory, "probe");

    try {
        writeFileSync(probe, "x");
        chmodSync(probe, 0o222);
        readFileSync(probe, "utf8");

        return false;
    } catch {
        return true;
    } finally {
        chmodSync(probe, 0o644);
        rmSync(directory, { force: true, recursive: true });
    }
};

const symlinksSupported = process.platform !== "win32";

describe("vis release init --from-semantic-release (issue #862)", () => {
    let cwd: string;

    beforeEach(() => {
        // Keeps `offerWorkflowGeneration` / `offerHuskyWiring` on their
        // non-interactive paths so the handler never blocks on a prompt.
        vi.stubEnv("CI", "true");
        prompts.answer = () => false;
        prompts.questions = [];
        cwd = setupFixture();
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        setTty(originalIsTty);
        // The refusal paths set `process.exitCode`; leaving it set would fail
        // the whole vitest run even when every test passed.
        process.exitCode = undefined;
        await rm(cwd, { force: true, recursive: true });
    });

    describe("--apply without --cutover", () => {
        it("leaves every .releaserc.json and manifest untouched", async () => {
            expect.hasAssertions();

            const before = {
                a: await readFile(join(cwd, "packages", "a", "package.json"), "utf8"),
                b: await readFile(join(cwd, "packages", "b", "package.json"), "utf8"),
            };

            await runInit(cwd, { apply: true });

            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(rcPath(cwd, "b"))).toBe(true);
            await expect(readFile(join(cwd, "packages", "a", "package.json"), "utf8")).resolves.toBe(before.a);
            await expect(readFile(join(cwd, "packages", "b", "package.json"), "utf8")).resolves.toBe(before.b);
        });

        it("still scaffolds .vis/release, the ignore files and the config block", async () => {
            expect.hasAssertions();

            await runInit(cwd, { apply: true });

            expect(existsSync(join(cwd, ".vis", "release"))).toBe(true);
            await expect(readFile(join(cwd, ".gitignore"), "utf8")).resolves.toContain(".vis/release/.state.json");
            await expect(readFile(join(cwd, ".secretlintignore"), "utf8")).resolves.toContain(".vis/release/**");

            const config = await readFile(join(cwd, "vis.config.ts"), "utf8");

            expect(config).toContain("defaultManaged: false");
            expect(config).toContain("--cutover flips this to true");
        });

        it("keeps printing the per-package opt-in instructions", async () => {
            expect.hasAssertions();

            const { out } = await runInit(cwd, { apply: true });

            expect(out).toContain("Migration is per-package opt-in");
            expect(out).toContain("Existing .releaserc.json files are kept in place during transition.");
            expect(out).toContain("re-run with `--apply --cutover` to delete them");
        });
    });

    describe("--cutover", () => {
        it("deletes the migrated .releaserc.json files and marks every manifest managed", async () => {
            expect.hasAssertions();

            await runInit(cwd, { apply: true, cutover: true, yes: true });

            const [pkgA, pkgB] = [await readManifest(cwd, "a"), await readManifest(cwd, "b")];

            expect(existsSync(rcPath(cwd, "a"))).toBe(false);
            expect(existsSync(rcPath(cwd, "b"))).toBe(false);
            expect(pkgA["vis-release"]).toStrictEqual({ managed: true });
            expect(pkgB["vis-release"]).toStrictEqual({ managed: true });
        });

        it("generates a config that already says defaultManaged: true", async () => {
            expect.hasAssertions();

            await runInit(cwd, { apply: true, cutover: true, yes: true });

            const config = await readFile(join(cwd, "vis.config.ts"), "utf8");

            expect(config).toContain("defaultManaged: true,");
            expect(config).not.toContain("flips this to true");
            expect(config).not.toContain("Phase 6");
        });

        it("does not print the per-package opt-in tail after the writes", async () => {
            expect.hasAssertions();

            const { out } = await runInit(cwd, { apply: true, cutover: true, yes: true });

            expect(out).not.toContain("Migration is per-package opt-in");
            expect(out).not.toContain("Re-run with `--apply`");
            expect(out).toContain("Full cutover (--cutover)");
        });

        it("lists the deletions and manifest edits in --dry-run without performing them", async () => {
            expect.hasAssertions();

            const { out } = await runInit(cwd, { cutover: true, dryRun: true });

            expect(out).toContain(`[dry-run] would delete ${join("packages", "a", ".releaserc.json")}`);
            expect(out).toContain(`[dry-run] would update ${join("packages", "a", "package.json")} (add vis-release.managed = true)`);
            expect(out).toContain("[dry-run] would create vis.config.ts (release block)");

            const pkgA = await readManifest(cwd, "a");

            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(join(cwd, "vis.config.ts"))).toBe(false);
            expect(pkgA["vis-release"]).toBeUndefined();
        });

        it("previews exactly the paths a subsequent --apply touches", async () => {
            expect.hasAssertions();

            const preview = await runInit(cwd, { cutover: true, dryRun: true });
            const applied = await runInit(cwd, { apply: true, cutover: true, yes: true });

            const previewed = preview.infos
                .filter((line) => line.startsWith("[dry-run] would delete ") || line.startsWith("[dry-run] would update "))
                .map((line) => line.replace(/^\[dry-run\] would (?:delete|update) /, "").replace(/ \(.*\)$/, ""))
                .sort();

            const written = applied.infos
                .filter((line) => line.startsWith("  deleted ") || line.startsWith("  updated "))
                .map((line) => line.replace(/^ {2}(?:deleted|updated) /, "").replace(/ \(.*\)$/, ""))
                .sort();

            expect(previewed).toStrictEqual(written);
        });

        it("warns that --packages is ignored", async () => {
            expect.hasAssertions();

            const { warns } = await runInit(cwd, { apply: true, cutover: true, packages: "@scope/a", yes: true });

            const pkgB = await readManifest(cwd, "b");

            expect(warns).toContain("--packages is ignored because --cutover opts every detected package in.");
            expect(pkgB["vis-release"]).toStrictEqual({ managed: true });
        });

        it("performs no writes when --dry-run is also set", async () => {
            expect.hasAssertions();

            const { warns } = await runInit(cwd, { apply: true, cutover: true, dryRun: true });

            expect(warns).toContain("--apply is ignored because --dry-run is set (dry-run takes precedence).");
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(join(cwd, "vis.config.ts"))).toBe(false);
        });
    });

    describe("--packages", () => {
        it("marks only the selected package and keeps every .releaserc.json", async () => {
            expect.hasAssertions();

            await runInit(cwd, { apply: true, packages: "@scope/a" });

            const [pkgA, pkgB] = [await readManifest(cwd, "a"), await readManifest(cwd, "b")];

            expect(pkgA["vis-release"]).toStrictEqual({ managed: true });
            expect(pkgB["vis-release"]).toBeUndefined();
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(rcPath(cwd, "b"))).toBe(true);
        });

        it("accepts a workspace-relative directory as the selector", async () => {
            expect.hasAssertions();

            await runInit(cwd, { apply: true, packages: "packages/b" });

            const [pkgA, pkgB] = [await readManifest(cwd, "a"), await readManifest(cwd, "b")];

            expect(pkgB["vis-release"]).toStrictEqual({ managed: true });
            expect(pkgA["vis-release"]).toBeUndefined();
        });

        it("warns about an entry that matches nothing", async () => {
            expect.hasAssertions();

            const { warns } = await runInit(cwd, { apply: true, packages: "@scope/nope" });

            expect(warns).toContain("--packages: no package with a sibling .releaserc.* matched \"@scope/nope\".");
        });
    });

    describe("--dry-run without --cutover", () => {
        it("says no manifest or .releaserc.* is touched", async () => {
            expect.hasAssertions();

            const { out } = await runInit(cwd, { dryRun: true });

            expect(out).toContain("no package.json or .releaserc.* is touched");
            expect(out).toContain("Migration is per-package opt-in");
            expect(out).toContain("Re-run with `--apply`");
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
        });

        it("previews the selection when --packages is given", async () => {
            expect.hasAssertions();

            const { out } = await runInit(cwd, { dryRun: true, packages: "@scope/a" });

            expect(out).toContain(`[dry-run] would update ${join("packages", "a", "package.json")} (add vis-release.managed = true)`);
            expect(out).not.toContain(join("packages", "b", "package.json"));
            expect(out).not.toContain("[dry-run] would delete");
        });
    });

    it("warns when --cutover is used on a non-semantic-release source", async () => {
        expect.hasAssertions();

        const { warns } = await runInit(cwd, { cutover: true, fresh: true, fromSemanticRelease: false });

        expect(warns).toContain("`--cutover` / `--packages` only affect the semantic-release migration path.");
    });

    describe("cutover with an unwritable release config", () => {
        /**
         * A `vis.config.ts` that init cannot inject into: no `defineConfig({`,
         * no `export default {`, and no `release` key to leave alone.
         */
        const writeUninjectableConfig = (): void => {
            writeFileSync(join(cwd, "vis.config.ts"), "const config = { tasks: {} };\n\nexport default config;\n");
        };

        it("refuses to delete a single .releaserc.* when the config write is skipped", async () => {
            expect.hasAssertions();

            writeUninjectableConfig();

            const { errors } = await runInit(cwd, { apply: true, cutover: true, yes: true });

            expect(errors.join("\n")).toContain("Refusing to run the cutover");
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(rcPath(cwd, "b"))).toBe(true);
        });

        it("leaves the manifests untouched and exits non-zero", async () => {
            expect.hasAssertions();

            writeUninjectableConfig();

            await runInit(cwd, { apply: true, cutover: true, yes: true });

            const [pkgA, pkgB] = [await readManifest(cwd, "a"), await readManifest(cwd, "b")];

            expect(pkgA["vis-release"]).toBeUndefined();
            expect(pkgB["vis-release"]).toBeUndefined();
            expect(process.exitCode).toBe(1);
        });

        it("warns in --dry-run that the cutover would be refused", async () => {
            expect.hasAssertions();

            writeUninjectableConfig();

            const { warns } = await runInit(cwd, { cutover: true, dryRun: true });

            expect(warns.join("\n")).toContain("This cutover would be refused");
        });

        it("still runs the cutover when the config already declares a release key (Phase 6 re-run)", async () => {
            expect.hasAssertions();

            // What a prior `--apply` leaves behind: a config init will not
            // rewrite, but one the repo can still release from.
            writeFileSync(join(cwd, "vis.config.ts"), "export default defineConfig({\n    release: { baseBranch: \"main\" },\n});\n");

            await runInit(cwd, { apply: true, cutover: true, yes: true });

            const pkgA = await readManifest(cwd, "a");

            expect(existsSync(rcPath(cwd, "a"))).toBe(false);
            expect(pkgA["vis-release"]).toStrictEqual({ managed: true });
        });
    });

    describe("cutover confirmation gate", () => {
        it("refuses a non-interactive cutover that was not confirmed with --yes", async () => {
            expect.hasAssertions();

            const { errors } = await runInit(cwd, { apply: true, cutover: true });

            expect(errors.join("\n")).toContain("Refusing to delete 2 .releaserc.* file(s) without confirmation.");
            expect(errors.join("\n")).toContain("Re-run with `--yes`");
            expect(process.exitCode).toBe(1);
        });

        it("writes nothing at all when the confirmation is refused", async () => {
            expect.hasAssertions();

            await runInit(cwd, { apply: true, cutover: true });

            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(rcPath(cwd, "b"))).toBe(true);

            const pkgA = await readManifest(cwd, "a");

            expect(existsSync(join(cwd, "vis.config.ts"))).toBe(false);
            expect(pkgA["vis-release"]).toBeUndefined();
        });

        it("aborts without an error exit when an interactive operator declines", async () => {
            expect.hasAssertions();

            prompts.answer = () => false;
            vi.stubEnv("CI", "");
            setTty(true);

            const { out } = await runInit(cwd, { apply: true, cutover: true });

            expect(out).toContain("Cutover cancelled — no migration writes were made.");
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(process.exitCode).toBeUndefined();
        });

        it("proceeds when an interactive operator confirms", async () => {
            expect.hasAssertions();

            // Only the cutover question is answered yes — the workflow-generation
            // prompt further down stays declined.
            prompts.answer = (question: string) => question.startsWith("Delete ");
            vi.stubEnv("CI", "");
            setTty(true);

            await runInit(cwd, { apply: true, cutover: true });

            expect(prompts.questions.join("\n")).toContain("Delete 2 .releaserc.* file(s) and mark 2 package.json file(s) managed?");
            expect(existsSync(rcPath(cwd, "a"))).toBe(false);
            expect(process.exitCode).toBeUndefined();
        });
    });

    describe("manifest writes", () => {
        it("never opts a private manifest in, even when it has its own .releaserc.json", async () => {
            expect.hasAssertions();

            // The workspace root is private and carries a root-level config —
            // deleting that config is fine, marking the root managed is not.
            writeJson(join(cwd, ".releaserc.json"), { branches: ["main"] });

            const { warns } = await runInit(cwd, { apply: true, cutover: true, yes: true });

            const root = JSON.parse(await readFile(join(cwd, "package.json"), "utf8")) as Record<string, unknown>;

            expect(root["vis-release"]).toBeUndefined();
            expect(warns.join("\n")).toContain("`private: true` packages are not published");
            expect(existsSync(join(cwd, ".releaserc.json"))).toBe(false);
        });

        it("preserves a 2-space manifest's indentation instead of reformatting it", async () => {
            expect.hasAssertions();

            const manifestPath = join(cwd, "packages", "a", "package.json");

            writeJson(manifestPath, { name: "@scope/a", scripts: { build: "tsc" }, version: "1.0.0" }, 2);

            await runInit(cwd, { apply: true, packages: "@scope/a" });

            const after = await readFile(manifestPath, "utf8");

            expect(after).toContain("\n  \"name\": \"@scope/a\",");
            expect(after).toContain("\n    \"build\": \"tsc\"");
            expect(after).not.toContain("\n    \"name\"");
            expect(after.endsWith("}\n")).toBe(true);
        });

        it("preserves a tab-indented manifest and its missing trailing newline", async () => {
            expect.hasAssertions();

            const manifestPath = join(cwd, "packages", "b", "package.json");

            writeFileSync(manifestPath, JSON.stringify({ name: "@scope/b", version: "1.0.0" }, null, "\t"));

            await runInit(cwd, { apply: true, packages: "@scope/b" });

            const after = await readFile(manifestPath, "utf8");

            expect(after).toContain("\n\t\"name\": \"@scope/b\",");
            expect(after).toContain("\n\t\"vis-release\": {");
            expect(after.endsWith("}")).toBe(true);
        });
    });
    describe("a config that only looks configured (CodeRabbit F1)", () => {
        /**
         * The cutover's safety guard asks one question: "will this repo still
         * have a release config once every `.releaserc.*` is gone?" A textual
         * `/\brelease\s*:/` answered yes for a comment, a string and a
         * nested key — a non-blocking skip, which let the deletions run
         * against a config that declares nothing.
         */
        it.each([
            ["a commented-out release key", "export default defineConfig({\n    // release: { baseBranch: \"main\" },\n    tasks: {},\n});\n"],
            ["a release key nested under tasks", "export default defineConfig({\n    tasks: { release: { command: \"echo\" } },\n});\n"],
            ["the word release inside a string", "export default defineConfig({\n    tasks: { build: { command: \"echo release: prod\" } },\n});\n"],
        ])("writes a real release block before deleting anything when the config has %s", async (_label, source) => {
            expect.hasAssertions();

            writeFileSync(join(cwd, "vis.config.ts"), source);

            await runInit(cwd, { apply: true, cutover: true, yes: true });

            const config = await readFile(join(cwd, "vis.config.ts"), "utf8");

            // The block landed, so the repo is releasable after the deletions.
            expect(config).toContain("defaultManaged: true,");
            expect(config).toContain("channels: {");
            expect(existsSync(rcPath(cwd, "a"))).toBe(false);
        });

        it("still leaves a genuinely declared root release key alone", async () => {
            expect.hasAssertions();

            const source = "export default defineConfig({\n    release: { baseBranch: \"main\" },\n    tasks: {},\n});\n";

            writeFileSync(join(cwd, "vis.config.ts"), source);

            const { warns } = await runInit(cwd, { apply: true, cutover: true, yes: true });

            await expect(readFile(join(cwd, "vis.config.ts"), "utf8")).resolves.toBe(source);
            expect(warns.join("\n")).toContain("already has a `release` key");
        });

        it("blocks the cutover when the config object never closes", async () => {
            expect.hasAssertions();

            writeFileSync(join(cwd, "vis.config.ts"), "export default defineConfig({\n    tasks: {},\n");

            const { errors } = await runInit(cwd, { apply: true, cutover: true, yes: true });

            expect(errors.join("\n")).toContain("Refusing to run the cutover");
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
        });
    });

    describe("workspace containment (CodeRabbit F2)", () => {
        it.skipIf(!symlinksSupported)("never walks a symlinked directory out of the workspace", async () => {
            expect.hasAssertions();

            const outside = makeOutsideDir();
            const victim = join(outside, "victim");

            mkdirSync(victim, { recursive: true });
            writeJson(join(victim, "package.json"), { name: "@outside/victim", version: "1.0.0" });
            writeJson(join(victim, ".releaserc.json"), { branches: ["main"] });
            symlinkSync(outside, join(cwd, "packages", "vendor"), "dir");

            try {
                await runInit(cwd, { apply: true, cutover: true, yes: true });

                // Nothing outside `cwd` was read, marked managed or deleted.
                expect(existsSync(join(victim, ".releaserc.json"))).toBe(true);

                const manifest = JSON.parse(readFileSync(join(victim, "package.json"), "utf8")) as Record<string, unknown>;

                expect(manifest["vis-release"]).toBeUndefined();

                // The packages that really are in the workspace still migrated.
                expect(existsSync(rcPath(cwd, "a"))).toBe(false);
            } finally {
                rmSync(outside, { force: true, recursive: true });
            }
        });
    });

    describe("a migration run without --apply (CodeRabbit F3)", () => {
        it("writes nothing at all — not even the scaffold or the ignore files", async () => {
            expect.hasAssertions();

            await runInit(cwd, {});

            expect(existsSync(join(cwd, ".vis", "release"))).toBe(false);
            expect(existsSync(join(cwd, ".gitignore"))).toBe(false);
            expect(existsSync(join(cwd, ".secretlintignore"))).toBe(false);
            expect(existsSync(join(cwd, "vis.config.ts"))).toBe(false);
        });

        it("says it is a preview and lists the writes --apply would make", async () => {
            expect.hasAssertions();

            const { out } = await runInit(cwd, {});

            expect(out).toContain("Preview only — a semantic-release migration writes nothing without `--apply`.");
            expect(out).toContain(`[dry-run] would create directory: ${join(cwd, ".vis", "release")}`);
            expect(out).toContain("[dry-run] would create vis.config.ts (release block)");
        });

        it("still scaffolds by default on a fresh repo — only migrations preview", async () => {
            expect.hasAssertions();

            await runInit(cwd, { fresh: true, fromSemanticRelease: false });

            expect(existsSync(join(cwd, ".vis", "release"))).toBe(true);
            await expect(readFile(join(cwd, ".gitignore"), "utf8")).resolves.toContain(".vis/release/.state.json");
        });
    });

    describe("unreadable is not missing (CodeRabbit F4)", () => {
        it("aborts the cutover instead of silently skipping a package.json it cannot read", async () => {
            expect.hasAssertions();

            // A directory in the manifest's place fails every read with EISDIR
            // — the error the old catch-all folded into "no package.json here".
            rmSync(join(cwd, "packages", "a", "package.json"));
            mkdirSync(join(cwd, "packages", "a", "package.json"));

            await expect(runInit(cwd, { apply: true, cutover: true, yes: true })).rejects.toThrow(/EISDIR/);

            // The migration stopped before the deletions, so nothing is lost.
            expect(existsSync(rcPath(cwd, "a"))).toBe(true);
            expect(existsSync(rcPath(cwd, "b"))).toBe(true);
        });

        it.skipIf(!chmodDeniesReads())("does not replace a .gitignore it cannot read", async () => {
            expect.hasAssertions();

            const gitignore = join(cwd, ".gitignore");
            const before = "node_modules\ndist\n";

            writeFileSync(gitignore, before);
            // Write-only: the read fails, the write would have succeeded — the
            // exact shape that turned an EACCES into a brand-new .gitignore.
            chmodSync(gitignore, 0o222);

            try {
                await expect(runInit(cwd, { apply: true })).rejects.toThrow(/EACCES/);
            } finally {
                chmodSync(gitignore, 0o644);
            }

            expect(readFileSync(gitignore, "utf8")).toBe(before);
        });
    });

    describe("ignore rules are matched as whole lines (CodeRabbit F5)", () => {
        it("adds the real rules even when a comment mentions them", async () => {
            expect.hasAssertions();

            writeFileSync(join(cwd, ".gitignore"), "node_modules\n# .vis/release/.state.json\n# .vis/release/.lock\n");

            await runInit(cwd, { apply: true });

            const gitignore = await readFile(join(cwd, ".gitignore"), "utf8");

            expect(gitignore.split(/\r?\n/)).toContain(".vis/release/.state.json");
            expect(gitignore.split(/\r?\n/)).toContain(".vis/release/.lock");
        });

        it("treats a longer path that merely contains the rule as a different rule", async () => {
            expect.hasAssertions();

            writeFileSync(join(cwd, ".secretlintignore"), "vendor/.vis/release/**\n");

            await runInit(cwd, { apply: true });

            const secretlintignore = await readFile(join(cwd, ".secretlintignore"), "utf8");

            expect(secretlintignore.split(/\r?\n/)).toContain(".vis/release/**");
        });

        it("does not re-add a rule the file already declares", async () => {
            expect.hasAssertions();

            const before = "node_modules\n.vis/release/.state.json\n.vis/release/.lock\n";

            writeFileSync(join(cwd, ".gitignore"), before);

            await runInit(cwd, { apply: true });

            await expect(readFile(join(cwd, ".gitignore"), "utf8")).resolves.toBe(before);
        });
    });

    describe("writes never follow a symlink (CodeRabbit F6)", () => {
        it.skipIf(!symlinksSupported)("refuses to write a .gitignore that is a dangling symlink", async () => {
            expect.hasAssertions();

            const outside = makeOutsideDir();
            const target = join(outside, "stolen");

            symlinkSync(target, join(cwd, ".gitignore"));

            try {
                await expect(runInit(cwd, { apply: true })).rejects.toThrow(/symlink/);

                expect(existsSync(target)).toBe(false);
            } finally {
                rmSync(outside, { force: true, recursive: true });
            }
        });

        it.skipIf(!symlinksSupported)("refuses to copy a change file through a symlinked destination", async () => {
            expect.hasAssertions();

            const outside = makeOutsideDir();
            const target = join(outside, "stolen.md");

            mkdirSync(join(cwd, ".changeset"), { recursive: true });
            writeFileSync(join(cwd, ".changeset", "sample.md"), "---\n\"@scope/a\": patch\n---\n\nfix a thing\n");
            mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
            symlinkSync(target, join(cwd, ".vis", "release", "sample.md"));

            try {
                await expect(runInit(cwd, { fromChangesets: true, fromSemanticRelease: false })).rejects.toThrow(/symlink/);

                expect(existsSync(target)).toBe(false);
            } finally {
                rmSync(outside, { force: true, recursive: true });
            }
        });
    });
});
