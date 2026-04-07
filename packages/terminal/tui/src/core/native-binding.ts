/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-unsafe-assignment, import/no-commonjs */
// ESM wrapper around the NAPI-RS CJS native binding
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load the native binding through the NAPI-RS generated platform-detecting loader
const native = require("../../index.js");

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

// Export each binding member with an explicit type so --isolatedDeclarations can emit declarations.
// eslint-disable-next-line prefer-destructuring -- Destructured bindings break --isolatedDeclarations
export const Renderer: RendererConstructor = _native.Renderer;
// eslint-disable-next-line prefer-destructuring -- Destructured bindings break --isolatedDeclarations
export const TerminalGuard: TerminalGuardConstructor = _native.TerminalGuard;
// eslint-disable-next-line prefer-destructuring -- Destructured bindings break --isolatedDeclarations
export const terminalSize: () => TerminalSize = _native.terminalSize;
