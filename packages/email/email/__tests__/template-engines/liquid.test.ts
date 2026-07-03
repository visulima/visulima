import { describe, expect, it } from "vitest";

import liquid from "../../src/template-engines/liquid";

describe("liquid template engine", () => {
    it("renders variables", async () => {
        expect.assertions(1);
        await expect(liquid("Hello {{ name }}!", { name: "World" })).resolves.toBe("Hello World!");
    });

    it("renders control flow and filters", async () => {
        expect.assertions(1);

        const template = "{% if vip %}VIP {% endif %}{{ name | upcase }}";

        await expect(liquid(template, { name: "ada", vip: true })).resolves.toBe("VIP ADA");
    });

    it("rejects a non-string template", async () => {
        expect.assertions(1);
        await expect(liquid(42)).rejects.toThrow("Liquid template must be a string");
    });
});
