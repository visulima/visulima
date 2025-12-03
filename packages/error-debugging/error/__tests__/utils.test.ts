import { describe, expect, it } from "vitest";

import normalizeLF from "../src/util/normalize-lf";

describe("utils", () => {
    describe(normalizeLF, () => {
        it("should normalize line endings to LF", () => {
            expect.assertions(1);

            const source = "const x = 10;\r\nconst error = x.y;\r";

            expect(normalizeLF(source)).toBe("const x = 10;\nconst error = x.y;\n");
        });
    });
});
