/* eslint-disable e18e/prefer-static-regex, no-bitwise, no-control-regex, radix, sonarjs/prefer-regexp-exec, unicorn/no-null, unicorn/prefer-code-point */
import { EventEmitter } from "tseep";

export interface MouseEvent {
    button: "left" | "right" | "middle" | "scrollUp" | "scrollDown";
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    x: number;
    y: number;
}

export class InputParser extends EventEmitter {
    private _boundHandleData: ((data: string) => void) | null = null;

    private _pasteBuffer: string | null = null;

    constructor(private stdin: NodeJS.ReadStream) {
        super();
    }

    start(): void {
        // Both raw mode calls are required and serve different purposes:
        // - crossterm enable_raw_mode (called by TerminalGuard) sets the OS terminal
        //   flags (no line buffering, no echo) for rendering purposes.
        // - Node's setRawMode(true) tells Node's stream layer to emit data byte-by-byte
        //   instead of waiting for newlines. Without this, stdin data events never fire.
        if (typeof this.stdin.setRawMode === "function") {
            this.stdin.setRawMode(true);
        }

        this.stdin.resume();
        this.stdin.setEncoding("utf8");
        this._boundHandleData = this.handleData.bind(this);
        this.stdin.on("data", this._boundHandleData);
    }

    stop(): void {
        if (typeof this.stdin.setRawMode === "function") {
            this.stdin.setRawMode(false);
        }

        this.stdin.pause();

        if (this._boundHandleData) {
            this.stdin.removeListener("data", this._boundHandleData);
            this._boundHandleData = null;
        }
    }

    private handleData(data: string) {
        // 1. Ctrl+C → exit
        if (data === "\u0003") {
            this.emit("exit");

            return;
        }

        // 2. Bracketed paste: \x1b[200~ ... \x1b[201~
        // Terminals send a start marker, the pasted text (possibly in multiple chunks),
        // and an end marker. We buffer everything between the markers.
        if (data.includes("\u001B[200~") || this._pasteBuffer !== null) {
            // Could arrive as one chunk or across multiple data events
            if (this._pasteBuffer === null) {
                // Start of paste — strip the opening marker, begin buffering
                this._pasteBuffer = data.replace("\u001B[200~", "");
            } else {
                this._pasteBuffer += data;
            }

            if (this._pasteBuffer.includes("\u001B[201~")) {
                // End marker arrived — emit the complete paste text.
                // Ink-compatible behavior:
                // - if a paste listener exists (usePaste/useTextInput), keep paste on that channel
                // - otherwise, fall back to normal input channel so useInput still receives pasted text
                const text = this._pasteBuffer.replace("\u001B[201~", "");

                this._pasteBuffer = null;
                this.emit("paste", text);

                if (this.listenerCount("paste") === 0) {
                    this.emit("data", text);
                }
            }

            return;
        }

        // 3. Ctrl+key combos (except Ctrl+C above and Ctrl+[ which is escape)
        // Excludes \t (9), \n (10), \r (13) which are handled as named keys below
        if (data.length === 1) {
            const code = data.charCodeAt(0);

            if (code >= 1 && code <= 26 && code !== 3 && code !== 9 && code !== 10 && code !== 13) {
                const letter = String.fromCharCode(code + 96); // 1→'a', 2→'b', etc.

                this.emit("ctrl", letter);
                this.emit("data", data, { ctrl: true });

                return;
            }
        }

        // 4. Arrow keys
        if (data === "\u001B[A") {
            this.emit("keydown", "up");

            return;
        }

        if (data === "\u001B[B") {
            this.emit("keydown", "down");

            return;
        }

        if (data === "\u001B[C") {
            this.emit("keydown", "right");

            return;
        }

        if (data === "\u001B[D") {
            this.emit("keydown", "left");

            return;
        }

        // 5. Tab / Shift+Tab
        if (data === "\t") {
            this.emit("keydown", "tab");

            return;
        }

        if (data === "\u001B[Z") {
            this.emit("keydown", "shift-tab");

            return;
        }

        // 6. Escape (bare \x1b — not followed by anything)
        if (data === "\u001B") {
            this.emit("keydown", "escape");

            return;
        }

        // 7. Enter/Return
        if (data === "\r" || data === "\n") {
            this.emit("keydown", "enter");

            return;
        }

        // 8. Backspace / Delete
        if (data === "\u007F") {
            this.emit("keydown", "backspace");

            return;
        }

        if (data === "\u001B[3~") {
            this.emit("keydown", "delete");

            return;
        }

        // 9. Page Up / Page Down / Home / End
        if (data === "\u001B[5~") {
            this.emit("keydown", "pageUp");

            return;
        }

        if (data === "\u001B[6~") {
            this.emit("keydown", "pageDown");

            return;
        }

        if (data === "\u001B[H" || data === "\u001B[1~") {
            this.emit("keydown", "home");

            return;
        }

        if (data === "\u001B[F" || data === "\u001B[4~") {
            this.emit("keydown", "end");

            return;
        }

        // 10. Meta (Alt) key combos: \x1b + single char
        if (data.length === 2 && data[0] === "\u001B") {
            this.emit("meta", data[1]);
            this.emit("data", data, { meta: true });

            return;
        }

        // 11. Mouse tracking (SGR 1006: \x1b[<button;x;yM or m)
        if (data.startsWith("\u001B[<")) {
            const match = data.match(/\u001B\[<(\d+);(\d+);(\d+)(M)/i);

            if (match) {
                const buttonCode = Number.parseInt(match[1]!);
                const x = Number.parseInt(match[2]!) - 1; // SGR is 1-indexed
                const y = Number.parseInt(match[3]!) - 1;
                const isRelease = match[4] === "m";

                // Modifier bits in buttonCode: bit 2=shift, bit 3=meta, bit 4=ctrl
                const shift = (buttonCode & 4) !== 0;
                const meta = (buttonCode & 8) !== 0;
                const ctrl = (buttonCode & 16) !== 0;

                const base = buttonCode & ~(4 | 8 | 16); // strip modifier bits

                let button: MouseEvent["button"] | null = null;

                if (base === 0 && !isRelease) {
                    button = "left";
                } else if (base === 1 && !isRelease) {
                    button = "middle";
                } else if (base === 2 && !isRelease) {
                    button = "right";
                } else if (base === 64) {
                    button = "scrollUp";
                } else if (base === 65) {
                    button = "scrollDown";
                }

                if (button) {
                    const event: MouseEvent = { button, ctrl, meta, shift, x, y };

                    this.emit("mouse", event);

                    // Back-compat: legacy 'click' event for left button press
                    if (button === "left") {
                        this.emit("click", { x, y });
                    }
                }
            }

            return;
        }

        // 12. Printable characters + unknown sequences
        this.emit("data", data);
    }
}
