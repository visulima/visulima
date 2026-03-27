import { vi } from "vitest";

// Mock the native binding module so tests can run without compiled .node files.
// The native Renderer/TerminalGuard are not needed for renderToString tests —
// only the pure JS/TS layout engine (Yoga) and React reconciler are exercised.
vi.mock("../src/core/native-binding.js", () => ({
    Renderer: class MockRenderer {
        width: number;
        height: number;
        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
        resize(_w: number, _h: number) {}
        setRowOffset(_offset: number) {}
        render(_buf: Uint32Array) {}
        renderDiff(_buf: Uint32Array) {
            return "";
        }
        writeRaw(_data: string) {}
    },
    TerminalGuard: class MockTerminalGuard {
        leave() {}
        getSize() {
            return { cols: 80, rows: 24 };
        }
    },
    terminalSize: () => ({ cols: 80, rows: 24 }),
}));
