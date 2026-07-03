import { describe, expect, it } from "vitest";

import hideBin from "../../../src/util/general/hide-bin";

describe("util/hide-bin", () => {
    it("hides bin for standard node.js application", () => {
        expect.assertions(1);

        expect(hideBin(["node", "foo.js", "--apple", "--banana"])).toStrictEqual(["--apple", "--banana"]);
    });
});
