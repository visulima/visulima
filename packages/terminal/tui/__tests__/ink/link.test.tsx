import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Link, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe(Link, () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("fallback mode (non-TTY)", () => {
        it("should append URL after text with default fallback", () => {
            // renderToString uses a mock stdout that is a TTY but process.stdout.isTTY
            // may not be set in test env. Force non-hyperlink mode.
            expect.assertions(1);

            vi.stubEnv("FORCE_HYPERLINK", "0");

            const output = renderToString(
                <Link url="https://example.com">
                    <Text>My Website</Text>
                </Link>,
            );

            expect(output).toBe("My Website https://example.com");
        });

        it("should render just text when fallback is false", () => {
            expect.assertions(1);

            vi.stubEnv("FORCE_HYPERLINK", "0");

            const output = renderToString(
                <Link fallback={false} url="https://example.com">
                    <Text>My Website</Text>
                </Link>,
            );

            expect(output).toBe("My Website");
        });

        it("should use custom fallback function", () => {
            expect.assertions(1);

            vi.stubEnv("FORCE_HYPERLINK", "0");

            const output = renderToString(
                <Link fallback={(text, url) => `[${text}](${url})`} url="https://example.com">
                    <Text>My Website</Text>
                </Link>,
            );

            expect(output).toBe("[My Website](https://example.com)");
        });
    });

    describe("hyperlink mode", () => {
        it("should render OSC 8 hyperlink when FORCE_HYPERLINK is set", () => {
            expect.assertions(3);

            vi.stubEnv("FORCE_HYPERLINK", "1");

            const output = renderToString(
                <Link url="https://example.com">
                    <Text>Click here</Text>
                </Link>,
            );

            // OSC 8 format: \x1b]8;;<url>\x07<text>\x1b]8;;\x07
            expect(output).toContain("https://example.com");
            expect(output).toContain("Click here");
            expect(output).toContain("\u001B]8");
        });
    });

    describe("children rendering", () => {
        it("should render plain text children", () => {
            expect.assertions(1);

            vi.stubEnv("FORCE_HYPERLINK", "0");

            const output = renderToString(<Link url="https://example.com">Visit</Link>);

            expect(output).toBe("Visit https://example.com");
        });
    });
});
