import { describe, expect, it } from "vitest";

import normalizeLF from "../src/util/normalize-lf";
import process from "../src/util/process";

describe("utils", () => {
    describe(normalizeLF, () => {
        it("should normalize line endings to LF", () => {
            expect.assertions(1);

            const source = "const x = 10;\r\nconst error = x.y;\r";

            expect(normalizeLF(source)).toBe("const x = 10;\nconst error = x.y;\n");
        });
    });

    describe("process proxy", () => {
        it("should forward properties that exist on the real process", () => {
            expect.assertions(1);

            expect(process.platform).toBe(globalThis.process.platform);
        });

        it("should return undefined for properties that exist on neither the process nor the shims", () => {
            expect.assertions(1);

            expect((process as unknown as Record<string, unknown>).thisPropertyDoesNotExist).toBeUndefined();
        });
    });
});
