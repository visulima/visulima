import { describe, expect, it } from "vitest";

import yamlLoc from "../src/util/yaml-loc";

describe(yamlLoc, () => {
    it("handles simplest case", () => {
        expect.assertions(1);

        const yaml = `
    simple:
      example: "hi"
    `;
        const count = yamlLoc(yaml);

        expect(count).toBe(2);
    });

    it("strips newlines", () => {
        expect.assertions(1);

        const yaml = `
    simple1:
      example: "hi"

    simple2:
      example: "hi"
    `;
        const count = yamlLoc(yaml);

        expect(count).toBe(4);
    });

    it("strips comments", () => {
        expect.assertions(1);

        const yaml = `
    # a comment
    simple1:
      example: "hi"

    #a comment
    simple2:
      example: "hi"
    `;
        const count = yamlLoc(yaml);

        expect(count).toBe(4);
    });

    it("strips indented comments", () => {
        expect.assertions(1);

        const yaml = `
    simple:
      #a comment
      example: "hi"
    `;
        const count = yamlLoc(yaml);

        expect(count).toBe(2);
    });

    it("doesn't strip inline comments", () => {
        expect.assertions(1);

        const yaml = `
    simple: # a comment
      example: "hi"
    `;
        const count = yamlLoc(yaml);

        expect(count).toBe(2);
    });

    it("doesn't strip components string", () => {
        expect.assertions(1);

        const yaml = `
    simple:
      example: "#/components/one/hi"
    `;
        const count = yamlLoc(yaml);

        expect(count).toBe(2);
    });
});
