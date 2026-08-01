import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * These specs deliberately import through the **bare package specifiers** rather than
 * `../../src/...`, because the defect they guard is in `package.json` `exports` key
 * order, not in the source.
 *
 * `@cloudflare/vitest-pool-workers` resolves with `["workerd", "worker", "module",
 * "browser"]` and drops `"node"`. Export conditions are matched in the order the keys
 * appear in `package.json`, so a `"browser"` key listed before the server entry wins on
 * Cloudflare and ships the `%c`-CSS console build to a runtime whose logs are plain
 * text. `"edge-light"` cannot save it — that is Vercel's condition and workerd never
 * sets it.
 */
describe("colorize package exports under workerd", () => {
    it("should resolve the server build, not the browser build", async () => {
        expect.assertions(3);

        const { default: colorize, red } = await import("@visulima/colorize");

        // The browser build returns `["%cfoo", "color: red;"]`; the server build returns a string.
        expect(colorize.red("foo")).toBeTypeOf("string");
        expect(Array.isArray(red("foo"))).toBe(false);
        expect(red("foo")).toBe("foo");
    });

    it("should style with ANSI when the level is forced", async () => {
        expect.assertions(1);

        const { Colorize } = await import("@visulima/colorize");

        // `Colorize` is only exported by the server build; the browser entry has no
        // level concept at all, so this both resolves and proves the ANSI code path.
        expect(new Colorize({ level: 3 }).red("foo")).toBe("\u001B[31mfoo\u001B[39m");
    });
});

describe("is-ansi-color-supported package exports under workerd", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("should resolve the server detector, not the browser detector", async () => {
        expect.assertions(1);

        const { createIsColorSupported } = await import("@visulima/is-ansi-color-supported");

        vi.stubEnv("FORCE_COLOR", "2");

        // Only the server build reads `process.env`; the browser build sniffs
        // `navigator` and the edge-light build only looks at `NEXT_RUNTIME`, so both
        // would answer 0 here.
        expect(createIsColorSupported("stdout")).toBe(2);
    });

    it("should honour the detector options that only the server build implements", async () => {
        expect.assertions(2);

        const { createIsColorSupported } = await import("@visulima/is-ansi-color-supported");

        vi.stubEnv("TERM", "xterm");

        expect(createIsColorSupported("stdout", { isTTY: true })).toBe(1);
        expect(createIsColorSupported("stdout", { isTTY: false })).toBe(0);
    });
});
