/* eslint-disable @typescript-eslint/naming-convention, unicorn/no-null */
import { createDecMode, resetMode, setMode } from "@visulima/ansi";
import { EventEmitter } from "tseep";

import type { RendererInstance, TerminalGuardInstance } from "./native-binding";
import { Renderer, TerminalGuard } from "./native-binding";

// DEC Private Mode 2026 — Synchronized Output. Precomputed once.
// `setMode`/`resetMode` emit `CSI ?2026h` / `CSI ?2026l`.
const SynchronizedOutputMode = createDecMode(2026);
const DEC_2026_ON = setMode(SynchronizedOutputMode);
const DEC_2026_OFF = resetMode(SynchronizedOutputMode);

export class TuiApp extends EventEmitter {
    private renderer: RendererInstance;

    private terminal: TerminalGuardInstance | null = null;

    private backBuffer: Uint32Array;

    private width: number;

    private height: number;

    private isRunning: boolean = false;

    private stdoutBuffer: string[] = [];

    private stderrBuffer: string[] = [];

    constructor() {
        super();
        // Get terminal size from process.stdout — works without a TTY (falls back to 80×24).
        // The TerminalGuard is only constructed in start() when we actually need raw mode.
        this.width = process.stdout.columns || 80;
        this.height = process.stdout.rows || 24;

        this.renderer = new Renderer(this.width, this.height);
        this.backBuffer = new Uint32Array(this.width * this.height * 2);
    }

    /** Enters raw mode + alternate screen. Does NOT start any render loop. */
    start(): void {
        if (this.isRunning) {
            return;
        }

        // Enter raw mode, alternate screen, mouse tracking, and bracketed paste (RAII guard)
        this.terminal = new TerminalGuard(true);

        this.isRunning = true;
    }

    /** Request a clean exit — restores terminal, stops input, exits the process. */
    quit(): void {
        this.emit("quit");
    }

    /** Exits raw mode + alternate screen, then flushes any buffered stdout/stderr. */
    stop(): void {
        this.isRunning = false;
        this.terminal?.leave();
        this.terminal = null;

        // Flush buffered output now that the alternate screen is gone
        if (this.stdoutBuffer.length > 0) {
            process.stdout.write(this.stdoutBuffer.join(""));
            this.stdoutBuffer = [];
        }

        if (this.stderrBuffer.length > 0) {
            process.stderr.write(this.stderrBuffer.join(""));
            this.stderrBuffer = [];
        }
    }

    /**
     * Buffer a write to stdout. While the alternate screen is active, writing
     * directly would corrupt the TUI. Buffered output is flushed on stop().
     */
    writeStdout(text: string): void {
        if (this.isRunning) {
            this.stdoutBuffer.push(text);
        } else {
            process.stdout.write(text);
        }
    }

    /**
     * Buffer a write to stderr. While the alternate screen is active, writing
     * directly would corrupt the TUI. Buffered output is flushed on stop().
     */
    writeStderr(text: string): void {
        if (this.isRunning) {
            this.stderrBuffer.push(text);
        } else {
            process.stderr.write(text);
        }
    }

    /** Returns the shared Uint32Array back-buffer (width * height * 2 u32 cells). */
    getBuffer(): Uint32Array {
        return this.backBuffer;
    }

    /** Returns current terminal dimensions. */
    getSize(): { height: number; width: number } {
        return { height: this.height, width: this.width };
    }

    /** Update terminal dimensions (called on SIGWINCH). */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.renderer = new Renderer(width, height);
        this.backBuffer = new Uint32Array(width * height * 2);
    }

    /**
     * Callbacks fired on every frame after React paints the buffer but before
     * the Rust diff engine flushes to stdout. Use for direct buffer painting
     * that needs to overlay React output (animated graphs, overlays, FPS counters).
     * Multiple listeners are supported — they fire in registration order.
     */
    private beforeFlushListeners: ((buffer: Uint32Array, width: number, height: number) => void)[] = [];

    onBeforeFlush(function_: (buffer: Uint32Array, width: number, height: number) => void): () => void {
        this.beforeFlushListeners.push(function_);

        return () => {
            this.beforeFlushListeners = this.beforeFlushListeners.filter((f) => f !== function_);
        };
    }

    /**
     * Layout + paint synchronously. Called from the render loop on every dirty frame,
     * and directly on resize for immediate response.
     */
    paintNow(calculateLayout: (w: number, h: number) => void, renderToBuffer: (buf: Uint32Array, w: number, h: number) => void): void {
        if (!this.isRunning) {
            return;
        }

        calculateLayout(this.width, this.height);
        renderToBuffer(this.backBuffer, this.width, this.height);

        for (const function_ of this.beforeFlushListeners) {
            function_(this.backBuffer, this.width, this.height);
        }

        this.renderer.writeRaw(DEC_2026_ON);

        try {
            this.renderer.render(this.backBuffer);
        } finally {
            this.renderer.writeRaw(DEC_2026_OFF);
        }
    }
}
