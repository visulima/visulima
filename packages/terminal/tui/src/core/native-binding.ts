// ESM wrapper around the NAPI-RS CJS native binding
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load the native binding through the platform-detecting binding.js
const native = require("../../binding.js");

export interface TerminalSize {
    cols: number;
    rows: number;
}

export interface RendererInstance {
    readonly width: number;
    readonly height: number;
    resize(width: number, height: number): void;
    setRowOffset(offset: number): void;
    render(backBuffer: Uint32Array): void;
    renderDiff(backBuffer: Uint32Array): string;
    writeRaw(data: string): void;
}

export interface RendererConstructor {
    new (width: number, height: number): RendererInstance;
}

export interface TerminalGuardInstance {
    leave(): void;
    getSize(): TerminalSize;
}

export interface TerminalGuardConstructor {
    new (mouse?: boolean | undefined | null): TerminalGuardInstance;
}

type NativeBinding = {
    Renderer: RendererConstructor;
    TerminalGuard: TerminalGuardConstructor;
    terminalSize: () => TerminalSize;
};

const _native: NativeBinding = native as NativeBinding;

// Export each binding member with an explicit type so --isolatedDeclarations can emit declarations
// without needing to infer types from a destructured binding element.
export const Renderer: NativeBinding["Renderer"] = _native.Renderer;
export const TerminalGuard: NativeBinding["TerminalGuard"] = _native.TerminalGuard;
export const terminalSize: NativeBinding["terminalSize"] = _native.terminalSize;
