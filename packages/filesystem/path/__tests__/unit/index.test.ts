import { describe, expect, it } from "vitest";

import defaultPath, { posix, win32 } from "../../src";

describe("index barrel", () => {
    it("should expose posix as the POSIX implementation", () => {
        expect.assertions(2);

        expect(posix.join("/foo", "bar")).toBe("/foo/bar");
        expect(posix.sep).toBe("/");
    });

    it("should alias win32 to the same POSIX implementation", () => {
        expect.assertions(3);

        // win32 is intentionally aliased to the POSIX implementation (see CLAUDE.md).
        expect(win32.join("/foo", "bar")).toBe("/foo/bar");
        expect(win32.sep).toBe("/");
        expect(win32).toBe(posix);
    });

    it("should expose the default export as the POSIX implementation", () => {
        expect.assertions(2);

        expect(defaultPath.join("/foo", "bar")).toBe("/foo/bar");
        expect(defaultPath.normalize("a/../b")).toBe("b");
    });
});
