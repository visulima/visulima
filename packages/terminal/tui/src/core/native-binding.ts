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
    readonly height: number;
    render: (backBuffer: Uint32Array) => void;
    renderDiff: (backBuffer: Uint32Array) => string;
    resize: (width: number, height: number) => void;
    setRowOffset: (offset: number) => void;
    readonly width: number;
    writeRaw: (data: string) => void;
}

export type RendererConstructor = new (width: number, height: number) => RendererInstance;

export interface TerminalGuardInstance {
    getSize: () => TerminalSize;
    leave: () => void;
}

export type TerminalGuardConstructor = new (mouse?: boolean | undefined | null) => TerminalGuardInstance;

type NativeBinding = {
    Renderer: RendererConstructor;
    TerminalGuard: TerminalGuardConstructor;
    terminalSize: () => TerminalSize;
};

const _native: NativeBinding = native as NativeBinding;

// Export each binding member with an explicit type so --isolatedDeclarations can emit declarations
// without needing to infer types from a destructured binding element.
export const { Renderer } = _native;
export const { TerminalGuard } = _native;
export const { terminalSize } = _native;
