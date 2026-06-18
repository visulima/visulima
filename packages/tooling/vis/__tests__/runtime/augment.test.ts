import { writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prepareScriptRuntime } from "../../src/runtime/augment";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const TEST_KEYS = ["VIS_AUGMENT_TEST_A", "VIS_AUGMENT_TEST_B"];

describe(prepareScriptRuntime, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = createTemporaryDirectory("vis-augment-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspace);

        for (const key of TEST_KEYS) {
            Reflect.deleteProperty(process.env, key);
        }

        delete process.env["VIS_POLYFILL"];
    });

    it("loads the .env cascade, with real env winning over .env values", async () => {
        expect.hasAssertions();

        writeFileSync(join(workspace, ".env"), `${TEST_KEYS[0]}=fromenv\n${TEST_KEYS[1]}=alsoenv\n`);

        // A real env var must NOT be clobbered by .env (dotenv convention).
        Reflect.deleteProperty(process.env, TEST_KEYS[0] as string);
        process.env[TEST_KEYS[1] as string] = "preset";

        await prepareScriptRuntime(workspace);

        expect(process.env[TEST_KEYS[0]]).toBe("fromenv");
        expect(process.env[TEST_KEYS[1]]).toBe("preset");
    });

    it("does nothing with polyfills unless VIS_POLYFILL is set", async () => {
        expect.hasAssertions();

        delete process.env["VIS_POLYFILL"];

        // No .env, no VIS_POLYFILL → resolves cleanly, no throw.
        await expect(prepareScriptRuntime(workspace)).resolves.toBeUndefined();
    });
});
