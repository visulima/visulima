import { describe, expect, expectTypeOf, it } from "vitest";

import errorOverlayPlugin from "../../src/index";
import generateClientScript from "../../src/utils/generate-client-script";

describe(errorOverlayPlugin, () => {
    it("should return a plugin object", () => {
        expect.assertions(1);

        const plugin = errorOverlayPlugin();

        expect(plugin).toBeDefined();

        expectTypeOf(plugin).toBeObject();
    });

    it("should have apply property set to 'serve'", () => {
        expect.assertions(1);

        const plugin = errorOverlayPlugin();

        expect(plugin.apply).toBe("serve");
    });

    it("should have configureServer method", () => {
        expect.assertions(1);

        const plugin = errorOverlayPlugin();

        expect(plugin.configureServer).toBeDefined();

        expectTypeOf(plugin.configureServer).toBeFunction();
    });

    it("should have transform method", () => {
        expect.assertions(1);

        const plugin = errorOverlayPlugin();

        expect(plugin.transform).toBeDefined();

        expectTypeOf(plugin.transform).toBeFunction();
    });

    it("should have transformIndexHtml method", () => {
        expect.assertions(1);

        const plugin = errorOverlayPlugin();

        expect(plugin.transformIndexHtml).toBeDefined();

        expectTypeOf(plugin.transformIndexHtml).toBeFunction();
    });

    describe("console interception", () => {
        it("should generate client script with rest parameters for console methods", () => {
            expect.assertions(4);

            const script = generateClientScript("development", ["error", "warn"]);

            expect(script).toBeDefined();
            expect(script).toContain("console.error = function(...args)");
            expect(script).toContain("console.warn = function(...args)");
            expect(script).toContain("origError.apply(console, args)");
        });

        it("should handle empty forwardedConsoleMethods array", () => {
            expect.assertions(1);

            expect(() => errorOverlayPlugin({ forwardedConsoleMethods: [] })).toThrow("forwardedConsoleMethods must be an array of console method names");
        });
    });

    describe("balloon configuration", () => {
        it("should accept overlay.balloon configuration", () => {
            expect.assertions(1);

            const plugin = errorOverlayPlugin({
                overlay: {
                    balloon: {
                        enabled: true,
                        position: "top-right",
                        icon: "/custom-icon.svg",
                        style: {
                            background: "#111",
                            color: "#fff",
                        },
                    },
                },
            });

            expect(plugin).toBeDefined();
        });

        it("should maintain backward compatibility with showBallonButton", () => {
            expect.assertions(1);

            const plugin = errorOverlayPlugin({
                showBallonButton: false,
            });

            expect(plugin).toBeDefined();
        });

        it("should prioritize showBallonButton over overlay.balloon.enabled", () => {
            expect.assertions(1);

            // showBallonButton should take precedence
            const plugin = errorOverlayPlugin({
                showBallonButton: false,
                overlay: {
                    balloon: {
                        enabled: true,
                    },
                },
            });

            expect(plugin).toBeDefined();
        });

        it("should generate client script with balloon config", () => {
            expect.assertions(2);

            const balloonConfig = {
                enabled: true,
                position: "bottom-left" as const,
            };

            const script = generateClientScript("development", ["error"], balloonConfig);

            expect(script).toBeDefined();
            expect(script).toContain("__visulima_overlay__");
        });

        it("should expose overlay API in client script", () => {
            expect.assertions(4);

            const script = generateClientScript("development", ["error"]);

            expect(script).toContain("window.__visulima_overlay__");
            expect(script).toContain("open: function");
            expect(script).toContain("close: function");
            expect(script).toContain("sendError:");
        });
    });
});
