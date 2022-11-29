import { describe, expect, it } from "vitest";

import pick from "../../../src/utils/primitives/pick";

describe("utils", () => {
    describe("primitives", () => {
        it("pick", () => {
            expect(pick({ test: "test", rest: "rest" }, ["test"])).toMatchObject({
                test: "test",
            });
        });
    });
});
