import { describe, expect, it } from "vitest";

import { evaluateWhen } from "../src/target-options";

describe(evaluateWhen, () => {
    it("returns true for undefined (no condition)", () => {
        expect.assertions(1);
        expect(evaluateWhen(undefined, {}, "linux")).toBe(true);
    });

    it("$VAR matches when the env var is non-empty", () => {
        expect.assertions(3);
        expect(evaluateWhen("$CI", { CI: "true" }, "linux")).toBe(true);
        expect(evaluateWhen("$CI", { CI: "" }, "linux")).toBe(false);
        expect(evaluateWhen("$CI", {}, "linux")).toBe(false);
    });

    it("!VAR matches when the env var is empty or unset", () => {
        expect.assertions(2);
        expect(evaluateWhen("!CI", {}, "linux")).toBe(true);
        expect(evaluateWhen("!CI", { CI: "1" }, "linux")).toBe(false);
    });

    it("bare string is treated as an env-var name", () => {
        expect.assertions(1);
        expect(evaluateWhen("CI", { CI: "1" }, "linux")).toBe(true);
    });

    it("platform gate single value", () => {
        expect.assertions(2);
        expect(evaluateWhen({ platform: "darwin" }, {}, "darwin")).toBe(true);
        expect(evaluateWhen({ platform: "darwin" }, {}, "linux")).toBe(false);
    });

    it("platform gate array", () => {
        expect.assertions(2);
        expect(evaluateWhen({ platform: ["darwin", "linux"] }, {}, "linux")).toBe(true);
        expect(evaluateWhen({ platform: ["darwin", "linux"] }, {}, "win32")).toBe(false);
    });

    it("env + equals is strict match", () => {
        expect.assertions(2);
        expect(evaluateWhen({ env: "NODE_ENV", equals: "production" }, { NODE_ENV: "production" }, "linux")).toBe(true);
        expect(evaluateWhen({ env: "NODE_ENV", equals: "production" }, { NODE_ENV: "development" }, "linux")).toBe(false);
    });

    it("env + in is set membership", () => {
        expect.assertions(2);
        expect(evaluateWhen({ env: "BRANCH", in: ["main", "next"] }, { BRANCH: "next" }, "linux")).toBe(true);
        expect(evaluateWhen({ env: "BRANCH", in: ["main", "next"] }, { BRANCH: "feat" }, "linux")).toBe(false);
    });

    it("env alone checks non-empty", () => {
        expect.assertions(2);
        expect(evaluateWhen({ env: "TOKEN" }, { TOKEN: "abc" }, "linux")).toBe(true);
        expect(evaluateWhen({ env: "TOKEN" }, {}, "linux")).toBe(false);
    });

    it("platform + env combined must both match", () => {
        expect.assertions(2);
        expect(evaluateWhen({ env: "CI", platform: "linux" }, { CI: "1" }, "linux")).toBe(true);
        expect(evaluateWhen({ env: "CI", platform: "linux" }, { CI: "1" }, "darwin")).toBe(false);
    });
});
