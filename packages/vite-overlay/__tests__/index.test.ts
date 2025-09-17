import { describe, expect, expectTypeOf, it } from "vitest";

import errorOverlayPlugin from "../src/index.js";

describe(errorOverlayPlugin, () => {
    it("should return a plugin object", () => {
        const plugin = errorOverlayPlugin();

        expect(plugin).toBeDefined();

        expectTypeOf(plugin).toBeObject();
    });

    it("should have apply property set to 'serve'", () => {
        const plugin = errorOverlayPlugin();

        expect(plugin.apply).toBe("serve");
    });

    it("should have configureServer method", () => {
        const plugin = errorOverlayPlugin();

        expect(plugin.configureServer).toBeDefined();

        expectTypeOf(plugin.configureServer).toBeFunction();
    });

    it("should have transform method", () => {
        const plugin = errorOverlayPlugin();

        expect(plugin.transform).toBeDefined();

        expectTypeOf(plugin.transform).toBeFunction();
    });

    it("should have transformIndexHtml method", () => {
        const plugin = errorOverlayPlugin();

        expect(plugin.transformIndexHtml).toBeDefined();

        expectTypeOf(plugin.transformIndexHtml).toBeFunction();
    });
});
