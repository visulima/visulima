import { describe, expect, it } from "vitest";

import Option from "../../src/lib/option.js";
import Output from "../../src/lib/output.js";

describe("output", () => {
    it("no defs set", () => {
        expect.assertions(1);

        const output = new Output([{ name: "one" }]);

        expect(output.toObject()).toStrictEqual({});
    });

    it("one def set", () => {
        expect.assertions(1);

        const output = new Output([{ name: "one" }]);
        const option = Option.create({ name: "one" });

        option.set("yeah");
        output.set("one", option);

        expect(output.toObject(), {
            one: "yeah",
        });
    });
});
