import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadVisConfig } from "../../src/config/config";
import { VisConfigShapeError } from "../../src/errors";

const writeConfig = (path: string, body: string): void => {
    writeFileSync(path, `export default ${body};\n`);
};

describe("vis.config.ts shape validation", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-shape-"));
        mkdirSync(join(scratch, "node_modules"), { recursive: true });
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("names the offending key when a scopedTasks block uses invented field names", async () => {
        expect.assertions(3);

        // Previously this loaded fine and then died much later with a bare
        // `TypeError: Cannot convert undefined or null to object` thrown from
        // a bundled chunk, naming neither the config file nor `scopedTasks`.
        writeConfig(join(scratch, "vis.config.ts"), `{ scopedTasks: [{ pattern: "e2e*", config: { cache: false } }] }`);

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigShapeError);
        expect((error as Error).message).toContain("scopedTasks[0].tasks");
        expect((error as Error).message).toContain("pattern, config");
    });

    it("rejects scopedTasks given an object instead of an array", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "vis.config.ts"), `{ scopedTasks: { build: { cache: true } } }`);

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigShapeError);
        expect((error as Error).message).toContain("an array of `{ match?, tasks }` blocks");
    });

    it("rejects a non-object `match`", async () => {
        expect.assertions(2);

        writeConfig(join(scratch, "vis.config.ts"), `{ scopedTasks: [{ match: "frontend", tasks: { build: { cache: true } } }] }`);

        const error = await loadVisConfig(scratch).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(VisConfigShapeError);
        expect((error as Error).message).toContain("scopedTasks[0].match");
    });

    it("accepts a well-formed scopedTasks block", async () => {
        expect.assertions(1);

        writeConfig(join(scratch, "vis.config.ts"), `{ scopedTasks: [{ match: { tags: ["frontend"] }, tasks: { build: { cache: true } } }] }`);

        const config = await loadVisConfig(scratch);

        expect(config.scopedTasks).toHaveLength(1);
    });
});
