import { Console } from "node:console";
import { PassThrough } from "node:stream";

import { vi } from "vitest";

// patch-console uses `new console.Console(...)` which Vitest removes from its
// own patched console object. Replace patch-console globally with an identical
// implementation that uses `node:console`'s Console directly.
vi.mock(import("patch-console"), () => {
    const consoleMethods = [
        "assert",
        "count",
        "countReset",
        "debug",
        "dir",
        "dirxml",
        "error",
        "group",
        "groupCollapsed",
        "groupEnd",
        "info",
        "log",
        "table",
        "time",
        "timeEnd",
        "timeLog",
        "trace",
        "warn",
    ] as const;

    const patchConsole = (callback: (stream: "stdout" | "stderr", data: string) => void) => {
        const stdout = new PassThrough();
        const stderr = new PassThrough();

        (stdout as any).write = (data: string) => {
            callback("stdout", data);

            return true;
        };
        (stderr as any).write = (data: string) => {
            callback("stderr", data);

            return true;
        };
        const internalConsole = new Console(stdout as any, stderr as any);
        const originalMethods: Record<string, unknown> = {};

        for (const method of consoleMethods) {
            originalMethods[method] = console[method];
            (console as any)[method] = (internalConsole as any)[method];
        }

        return () => {
            for (const method of consoleMethods) {
                (console as any)[method] = originalMethods[method];
            }
        };
    };

    return { default: patchConsole };
});

// Mock the native binding module so tests can run without compiled .node files.
// The native Renderer/TerminalGuard are not needed for renderToString tests —
// only the pure JS/TS layout engine (Yoga) and React reconciler are exercised.
vi.mock(import("../src/core/native-binding.js"), () => {
    return {
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
        terminalSize: () => { return { cols: 80, rows: 24 }; },
    };
});
