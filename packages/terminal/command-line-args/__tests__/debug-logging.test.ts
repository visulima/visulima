import { afterEach, describe, expect, it, vi } from "vitest";

import { commandLineArgs } from "../src";

describe("debug logging", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("emits namespaced console.debug output when debug is enabled", () => {
        expect.assertions(2);

        const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

        const result = commandLineArgs([{ name: "one" }], { argv: ["--one", "1"], debug: true });

        expect(result).toStrictEqual({ one: "1" });
        expect(debugSpy.mock.calls.some((call) => typeof call[0] === "string" && call[0].includes("[command-line-args:index]"))).toBe(true);
    });

    it("does not emit console.debug output when debug is disabled", () => {
        expect.assertions(2);

        const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

        const result = commandLineArgs([{ name: "one" }], { argv: ["--one", "1"] });

        expect(result).toStrictEqual({ one: "1" });
        expect(debugSpy).not.toHaveBeenCalled();
    });
});
