import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { esc } from "../helpers";

describe("colorize per-instance options", () => {
    beforeEach(() => {
        // Force the auto-detected stdout level to TrueColor so we can prove the
        // per-instance `level` option overrides detection rather than relying on it.
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "3" },
        });
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("should disable color when constructed with level 0", async () => {
        expect.assertions(2);

        const { default: Colorize } = await import("../../src/colorize.server");

        const instance = new Colorize({ level: 0 });

        expect(esc(instance.red("foo"))).toBe("foo");
        expect(esc(instance.hex("#ff0000")("bar"))).toBe("bar");
    });

    it("should render basic 16 colors when constructed with level 1", async () => {
        expect.assertions(1);

        const { default: Colorize } = await import("../../src/colorize.server");

        const instance = new Colorize({ level: 1 });

        // hex red downsampled to ANSI 16 bright-red (91)
        expect(esc(instance.hex("#ff0000")("bar"))).toBe(String.raw`\x1b[91mbar\x1b[39m`);
    });

    it("should render TrueColor when constructed with level 3", async () => {
        expect.assertions(1);

        const { default: Colorize } = await import("../../src/colorize.server");

        const instance = new Colorize({ level: 3 });

        expect(esc(instance.rgb(10, 20, 30)("bar"))).toBe(String.raw`\x1b[38;2;10;20;30mbar\x1b[39m`);
    });

    it("should isolate state between instances created with different levels", async () => {
        expect.assertions(2);

        const { default: Colorize } = await import("../../src/colorize.server");

        const off = new Colorize({ level: 0 });
        const on = new Colorize({ level: 3 });

        // Touch the `off` instance first; it must not poison the `on` instance.
        expect(esc(off.red("foo"))).toBe("foo");
        expect(esc(on.red("foo"))).toBe(String.raw`\x1b[31mfoo\x1b[39m`);
    });

    it("should default to the detected stdout level when no options are passed", async () => {
        expect.assertions(1);

        const { default: Colorize } = await import("../../src/colorize.server");

        const instance = new Colorize();

        expect(esc(instance.red("foo"))).toBe(String.raw`\x1b[31mfoo\x1b[39m`);
    });
});

describe("colorizeStderr export", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "3" },
        });
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("should expose a colorizeStderr instance", async () => {
        expect.assertions(1);

        const { colorizeStderr } = await import("../../src/index.server.mts");

        expect(esc(colorizeStderr.red("err"))).toBe(String.raw`\x1b[31merr\x1b[39m`);
    });
});
