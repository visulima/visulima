import { describe, expect, it } from "vitest";

import Definitions from "../../src/lib/option-definitions.js";

describe("option definitions", () => {
    it(".get(long option)", () => {
        expect.assertions(1);

        const definitions = Definitions.from([{ name: "one" }]);

        expect(definitions.get("--one").name).toBe("one");
    });

    it(".get(short option)", () => {
        expect.assertions(1);

        const definitions = Definitions.from([{ alias: "o", name: "one" }]);

        expect(definitions.get("-o").name).toBe("one");
    });

    it(".get(name)", () => {
        expect.assertions(1);

        const definitions = Definitions.from([{ name: "one" }]);

        expect(definitions.get("one").name).toBe("one");
    });

    it(".validate()", () => {
        expect.assertions(1);
        expect(() => () => {
            const definitions = new Definitions();

            definitions.load([{ name: "one" }, { name: "one" }]);
        });
    });
});
