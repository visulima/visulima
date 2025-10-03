import { describe, expect, it } from "vitest";

import pick from "../../../src/utils/primitives/pick";

describe("utils", () => {
    describe("primitives", () => {
        it("pick", () => {
            expect(pick({ rest: "rest", test: "test" }, ["test"])).toMatchObject({
                test: "test",
            });
        });
    });
});
