import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("name unicode", () => {
    it("unicode names and aliases are permitted", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "один" }, { name: "两" }, { alias: "т", name: "три" }];
        const argv = ["--один", "1", "--两", "2", "-т", "3"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result.один).toBe("1");
        expect(result.两).toBe("2");
        expect(result.три).toBe("3");
    });
});
