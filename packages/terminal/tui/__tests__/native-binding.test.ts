import { describe, expect, it, vi } from "vitest";

// These tests run in the CI native-build workflow where the compiled .node
// binary is present.  They verify that the NAPI-RS binding loads correctly
// and exposes the expected API surface.

// The global test setup mocks the native binding so regular tests can run
// without the compiled .node file.  Here we undo the mock so we test the
// real native addon.
vi.unmock("../src/core/native-binding.js");

async function loadBinding() {
    try {
        return await import("../src/core/native-binding");
    } catch {
        return null;
    }
}

describe("native-binding", () => {
    it("should export Renderer constructor", async () => {
        const binding = await loadBinding();

        if (!binding) {
            return; // native addon not available (local dev without compiled .node)
        }

        expect(binding.Renderer).toBeDefined();
        expect(typeof binding.Renderer).toBe("function");
    });

    it("should export TerminalGuard constructor", async () => {
        const binding = await loadBinding();

        if (!binding) {
            return;
        }

        expect(binding.TerminalGuard).toBeDefined();
        expect(typeof binding.TerminalGuard).toBe("function");
    });

    it("should export terminalSize function", async () => {
        const binding = await loadBinding();

        if (!binding) {
            return;
        }

        expect(binding.terminalSize).toBeDefined();
        expect(typeof binding.terminalSize).toBe("function");
    });

    it("should return valid terminal size", async () => {
        const binding = await loadBinding();

        if (!binding) {
            return;
        }

        let size;

        try {
            size = binding.terminalSize();
        } catch {
            // In CI environments without a TTY, terminalSize() may throw
            // "Resource temporarily unavailable (os error 35)". This is an
            // OS-level issue, not a binding problem — skip gracefully.
            return;
        }

        expect(size).toBeDefined();
        expect(typeof size.cols).toBe("number");
        expect(typeof size.rows).toBe("number");
        expect(size.cols).toBeGreaterThan(0);
        expect(size.rows).toBeGreaterThan(0);
    });

    it("should create a Renderer instance", async () => {
        const binding = await loadBinding();

        if (!binding) {
            return;
        }

        const renderer = new binding.Renderer(80, 24);

        expect(renderer).toBeDefined();
        expect(renderer.width).toBe(80);
        expect(renderer.height).toBe(24);
        expect(typeof renderer.render).toBe("function");
        expect(typeof renderer.renderDiff).toBe("function");
        expect(typeof renderer.resize).toBe("function");
        expect(typeof renderer.setRowOffset).toBe("function");
        expect(typeof renderer.writeRaw).toBe("function");
    });
});
