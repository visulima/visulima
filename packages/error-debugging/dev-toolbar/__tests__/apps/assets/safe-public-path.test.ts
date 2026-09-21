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

    it("blocks a rooted path that smuggles a scheme separator", () => {
        expect.hasAssertions();

        expect(safePublicPath("/redirect?to=javascript:alert(1)")).toBe("#");
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
