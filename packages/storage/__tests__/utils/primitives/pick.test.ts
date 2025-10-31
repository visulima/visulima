import { describe, expect, it } from "vitest";

import pick from "../../../src/utils/primitives/pick";

describe("utils", () => {
    describe("primitives", () => {
        describe(pick, () => {
            it("should extract specified properties from an object", () => {
                expect.assertions(1);

                expect(pick({ rest: "rest", test: "test" }, ["test"])).toMatchObject({
                    test: "test",
                });
            });
        });
    });
});
