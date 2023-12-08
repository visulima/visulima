import { describe, it, expect } from "vitest";
import hideBin from "../../../src/util/hide-bin";

describe("util/hide-bin", () => {
    it("hides bin for standard node.js application", () => {
        const args = hideBin(["node", "foo.js", "--apple", "--banana"]);

        expect(args).toEqual(["--apple", "--banana"]);
    });
});
