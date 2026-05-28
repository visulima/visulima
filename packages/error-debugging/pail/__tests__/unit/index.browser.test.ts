import { describe, expect, it } from "vitest";

import { createPail, createPailError, pail, PailError } from "../../src/index.browser";
import { PailBrowser } from "../../src/pail.browser";

describe("index.browser", () => {
    it("should expose a preconfigured default pail instance", () => {
        expect.assertions(1);

        expect(pail.info).toBeTypeOf("function");
    });

    it("should re-export the pail error helpers", () => {
        expect.assertions(2);

        expect(PailError).toBeTypeOf("function");
        expect(createPailError).toBeTypeOf("function");
    });

    it("should create a browser logger instance via createPail", () => {
        expect.assertions(1);

        expect(createPail()).toBeInstanceOf(PailBrowser);
    });
});
