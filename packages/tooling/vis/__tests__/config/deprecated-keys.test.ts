import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadVisConfig } from "../../src/config/config";
import { VisConfigDeprecatedKeyError } from "../../src/errors";

const writeConfig = (path: string, body: string): void => {
    writeFileSync(path, `export default ${body};\n`);
};

describe("vis.config.ts deprecated-key detection", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-deprecated-"));
        mkdirSync(join(scratch, "node_modules"), { recursive: true });
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("throws VisConfigDeprecatedKeyError when `targetDefaults` is used", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "vis.config.ts"), `{ targetDefaults: { build: { cache: true } } }`);

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigDeprecatedKeyError);
        expect((error as VisConfigDeprecatedKeyError).message).toContain("targetDefaults");
    });

    it("throws when `taskDefaults` is used and lists the inner `scope`/`targets` renames", async () => {
        expect.assertions(3);

        writeConfig(
            join(scratch, "vis.config.ts"),
            `{ taskDefaults: [{ scope: { tags: ["frontend"] }, targets: { build: { cache: true } } }] }`,
        );

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigDeprecatedKeyError);
        expect((error as VisConfigDeprecatedKeyError).message).toContain("taskDefaults");
        expect((error as VisConfigDeprecatedKeyError).message).toContain("scopedTasks");
    });

    it("throws when `taskRunnerOptions` is used", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "vis.config.ts"), `{ taskRunnerOptions: { parallel: 4 } }`);

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigDeprecatedKeyError);
        expect((error as VisConfigDeprecatedKeyError).message).toContain("taskRunner");
    });

    it("throws when scopedTasks blocks still use the old `scope`/`targets` inner keys", async () => {
        expect.assertions(2);

        writeConfig(
            join(scratch, "vis.config.ts"),
            `{ scopedTasks: [{ scope: { tags: ["api"] }, targets: { build: { cache: true } } }] }`,
        );

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigDeprecatedKeyError);
        expect((error as VisConfigDeprecatedKeyError).message).toContain("match");
    });

    it("accepts the new field names without error", async () => {
        expect.assertions(1);

        writeConfig(
            join(scratch, "vis.config.ts"),
            `{ tasks: { build: { cache: true } }, scopedTasks: [{ match: { tags: ["x"] }, tasks: { build: {} } }], taskRunner: { parallel: 2 } }`,
        );

        const config = await loadVisConfig(scratch);

        expect(config.tasks?.build).toMatchObject({ cache: true });
    });
});
