import { describe, expect, it } from "vitest";

import hideBin from "../../../src/util/hide-bin";

describe("util/hide-bin", () => {
    it("hides bin for standard node.js application", () => {
        expect(hideBin(["node", "foo.js", "--apple", "--banana"])).toStrictEqual(["--apple", "--banana"]);
    });
});
