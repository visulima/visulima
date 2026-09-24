import { describe, expect, it } from "vitest";

import { safePublicPath } from "../../../src/apps/assets/safe-public-path";

describe(safePublicPath, () => {
    it("passes a rooted same-origin path through", () => {
        expect.hasAssertions();

        expect(safePublicPath("/images/logo.svg")).toBe("/images/logo.svg");
    });

    it("blocks a javascript: uri", () => {
        expect.hasAssertions();

        // The literal scheme is the point of the test.
        // eslint-disable-next-line no-script-url
        expect(safePublicPath("javascript:alert(1)")).toBe("#");
    });

    it("blocks a data: uri", () => {
        expect.hasAssertions();

        expect(safePublicPath("data:text/html,<script>alert(1)</script>")).toBe("#");
    });

    it("blocks an absolute url to another origin", () => {
        expect.hasAssertions();

        expect(safePublicPath("https://evil.example/x.png")).toBe("#");
    });

    it("blocks a protocol-relative url", () => {
        expect.hasAssertions();

        expect(safePublicPath("//evil.example/x.png")).toBe("#");
    });

    it("blocks a backslash, which the url parser folds to a slash", () => {
        expect.hasAssertions();

        // `/\\evil.com` has no colon and starts with one slash, so a
        // colon-and-double-slash rule lets it through; the parser then reads
        // it as `http://evil.com/`.
        expect(safePublicPath(String.raw`/\evil.com`)).toBe("#");
    });

    it("blocks a tab or newline, which the url parser strips before parsing", () => {
        expect.hasAssertions();

        expect(safePublicPath("/\t/evil.com")).toBe("#");
        expect(safePublicPath("/\n/evil.com")).toBe("#");
        expect(safePublicPath("/\r/evil.com")).toBe("#");
    });

    it("allows a same-origin path that merely mentions a scheme in a query", () => {
        expect.hasAssertions();

        // This navigates to /redirect on our own origin; the colon is data,
        // not a scheme, so rejecting it was over-strict.
        expect(safePublicPath("/redirect?to=javascript:alert(1)")).toBe("/redirect?to=javascript:alert(1)");
    });

    it("blocks a relative path, which would resolve against the panel", () => {
        expect.hasAssertions();

        expect(safePublicPath("images/logo.svg")).toBe("#");
    });

    it("blocks an empty path", () => {
        expect.hasAssertions();

        expect(safePublicPath("")).toBe("#");
    });
});
