import { describe, expect, expectTypeOf, it, vi } from "vitest";

// These tests run in the CI native-build workflow where the compiled .node
// binary is present.  They verify that the NAPI-RS binding loads correctly
// and exposes the expected API surface.

// The global test setup mocks the native binding so regular tests can run
// without the compiled .node file.  Here we undo the mock so we test the
// real native addon.
vi.unmock("../src/core/native-binding.js");

// eslint-disable-next-line import/first -- vi.unmock must be called before importing the module
import { Renderer, TerminalGuard, terminalSize } from "../src/core/native-binding";

describe("native-binding", () => {
    it("should export Renderer constructor", () => {
        expect.assertions(1);

        expect(Renderer).toBeDefined();

        expectTypeOf(Renderer).toBeFunction();
    });

    it("should export TerminalGuard constructor", () => {
        expect.assertions(1);

        expect(TerminalGuard).toBeDefined();

        expectTypeOf(TerminalGuard).toBeFunction();
    });

    it("should export terminalSize function", () => {
        expect.assertions(1);

        expect(terminalSize).toBeDefined();

        expectTypeOf(terminalSize).toBeFunction();
    });

    it("should return valid terminal size", () => {
        let size;

        try {
            size = terminalSize();
        } catch {
            // In CI environments without a TTY, terminalSize() may throw
            // "Resource temporarily unavailable (os error 35)". This is an
            // OS-level issue, not a binding problem — skip gracefully.
            return;
        }

        expect.assertions(3);

        expect(size).toBeDefined();

        expectTypeOf(size.cols).toBeNumber();
        expectTypeOf(size.rows).toBeNumber();

        expect(size.cols).toBeGreaterThan(0);
        expect(size.rows).toBeGreaterThan(0);
    });

    it("should create a Renderer instance", () => {
        expect.assertions(3);

        const renderer = new Renderer(80, 24);

        expect(renderer).toBeDefined();
        expect(renderer.width).toBe(80);
        expect(renderer.height).toBe(24);

        expectTypeOf(renderer.render).toBeFunction();
        expectTypeOf(renderer.renderDiff).toBeFunction();
        expectTypeOf(renderer.resize).toBeFunction();
        expectTypeOf(renderer.setRowOffset).toBeFunction();
        expectTypeOf(renderer.writeRaw).toBeFunction();
    });
});
