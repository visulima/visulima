import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadVisConfig } from "../../src/config/config";
import { VisConfigCycleError, VisConfigNotFoundError } from "../../src/errors";

/**
 * Writes a `vis.config.ts` (or arbitrary filename) at the given path,
 * defaulting export to a config literal expressed as a JS-source string.
 */
const writeConfig = (path: string, body: string): void => {
    writeFileSync(path, `export default ${body};\n`);
};

describe("vis.config.ts extends chain", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-extends-"));
        // node_modules has to exist so getConfigCachePath finds a writable
        // location — without it the loader falls back to findCacheDirSync
        // which traverses upward and may resolve outside the fixture.
        mkdirSync(join(scratch, "node_modules"), { recursive: true });
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("loads a single-file config with no extends", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "vis.config.ts"), `{ tasks: { build: { cache: true } } }`);

        const config = await loadVisConfig(scratch);

        expect(config.tasks?.build).toMatchObject({ cache: true });
    });

    it("merges a relative-path extends — child wins per top-level key", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "shared.config.ts"), `{ tasks: { build: { cache: false }, lint: { cache: true } } }`);
        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./shared.config.ts"], tasks: { build: { cache: true } } }`);

        const config = await loadVisConfig(scratch);

        // Child overrode `build.cache` — preserved
        expect(config.tasks?.build).toMatchObject({ cache: true });
        // Parent's `lint` survived because the child didn't redefine it
        expect(config.tasks?.lint).toMatchObject({ cache: true });
    });

    it("handles the @inherit sentinel across extends", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "shared.config.ts"), `{ tasks: { build: { dependsOn: ["^build"] } } }`);
        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./shared.config.ts"], tasks: { build: { dependsOn: ["@inherit", "lint"] } } }`);

        const config = await loadVisConfig(scratch);

        expect(config.tasks?.build?.dependsOn).toStrictEqual(["^build", "lint"]);
    });

    it("processes multi-element extends left-to-right (later wins)", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "a.config.ts"), `{ tasks: { build: { cache: false } } }`);
        writeConfig(join(scratch, "b.config.ts"), `{ tasks: { build: { cache: true } } }`);
        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./a.config.ts", "./b.config.ts"] }`);

        const config = await loadVisConfig(scratch);

        // b extends after a, and root has nothing — b wins.
        expect(config.tasks?.build?.cache).toBe(true);
    });

    it("throws VisConfigCycleError on a cyclic extends chain", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./b.config.ts"] }`);
        writeConfig(join(scratch, "b.config.ts"), `{ extends: ["./vis.config.ts"] }`);

        await expect(loadVisConfig(scratch)).rejects.toBeInstanceOf(VisConfigCycleError);
        await expect(loadVisConfig(scratch)).rejects.toMatchObject({ message: expect.stringContaining("re-enters") });
    });

    it("allows diamond extends (same file pulled in via two paths)", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "leaf.config.ts"), `{ tasks: { build: { cache: true } } }`);
        writeConfig(join(scratch, "a.config.ts"), `{ extends: ["./leaf.config.ts"] }`);
        writeConfig(join(scratch, "b.config.ts"), `{ extends: ["./leaf.config.ts"] }`);
        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./a.config.ts", "./b.config.ts"] }`);

        const config = await loadVisConfig(scratch);

        // Diamond resolves cleanly, leaf merged once.
        expect(config.tasks?.build?.cache).toBe(true);
    });

    it("rejects absolute paths in extends", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["/etc/passwd"] }`);

        await expect(loadVisConfig(scratch)).rejects.toBeInstanceOf(VisConfigNotFoundError);
    });

    it("raises VisConfigNotFoundError on a missing relative path", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./does-not-exist.ts"] }`);

        await expect(loadVisConfig(scratch)).rejects.toBeInstanceOf(VisConfigNotFoundError);
    });

    it("concatenates scopedTasks blocks across the chain (parent first)", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "shared.config.ts"), `{ scopedTasks: [{ match: { tags: ["base"] }, tasks: { build: { cache: true } } }] }`);
        writeConfig(
            join(scratch, "vis.config.ts"),
            `{ extends: ["./shared.config.ts"], scopedTasks: [{ match: { tags: ["app"] }, tasks: { build: { cache: false } } }] }`,
        );

        const config = await loadVisConfig(scratch);

        expect(config.scopedTasks).toHaveLength(2);
        // Parent's block lands first, root's block second — preserves the
        // existing "later wins" semantics for matching scopes.
        expect(config.scopedTasks?.[0]?.match?.tags).toStrictEqual(["base"]);
    });

    it("strips `extends` from the merged result", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "shared.config.ts"), `{ tasks: {} }`);
        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./shared.config.ts"] }`);

        const config = await loadVisConfig(scratch);

        expect(config.extends).toBeUndefined();
    });

    it("merges fileGroups from extends", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "shared.config.ts"), `{ fileGroups: { sources: ["src/**/*.ts"] } }`);
        writeConfig(join(scratch, "vis.config.ts"), `{ extends: ["./shared.config.ts"], fileGroups: { tests: ["**/*.test.ts"] } }`);

        const config = await loadVisConfig(scratch);

        expect(config.fileGroups?.sources).toStrictEqual(["src/**/*.ts"]);
        expect(config.fileGroups?.tests).toStrictEqual(["**/*.test.ts"]);
    });

    it("deep-merges security.policies sub-bodies across extends (parent allow + child strict survive both)", async () => {
        // Regression: a shared preset that only sets `installScripts.allow`
        // must not be wiped when the consumer config sets a different field
        // (`installScripts.strict`) on the same policy. Prior to the fix the
        // per-policy bodies merged shallowly so the child object entirely
        // replaced the parent.
        expect.assertions(3);

        writeConfig(
            join(scratch, "shared.config.ts"),
            `{ security: { policies: { installScripts: { allow: { "esbuild": true } } } } }`,
        );
        writeConfig(
            join(scratch, "vis.config.ts"),
            `{ extends: ["./shared.config.ts"], security: { policies: { installScripts: { strict: false } } } }`,
        );

        const config = await loadVisConfig(scratch);

        expect(config.security?.policies?.installScripts?.allow?.esbuild).toBe(true);
        expect(config.security?.policies?.installScripts?.strict).toBe(false);
        // publisherChange comes from SECURITY_DEFAULTS — survives the merge.
        expect(config.security?.policies?.publisherChange?.mode).toBe("no-downgrade");
    });

    it("merges acceptedRisks entries across extends (parent + child entries both survive)", async () => {
        expect.assertions(2);

        writeConfig(
            join(scratch, "shared.config.ts"),
            `{ security: { acceptedRisks: { "lodash": { reason: "preset", acceptedAt: "2026-01-01" } } } }`,
        );
        writeConfig(
            join(scratch, "vis.config.ts"),
            `{ extends: ["./shared.config.ts"], security: { acceptedRisks: { "left-pad": { reason: "consumer", acceptedAt: "2026-02-01" } } } }`,
        );

        const config = await loadVisConfig(scratch);

        expect(config.security?.acceptedRisks?.["lodash"]?.reason).toBe("preset");
        expect(config.security?.acceptedRisks?.["left-pad"]?.reason).toBe("consumer");
    });
});
