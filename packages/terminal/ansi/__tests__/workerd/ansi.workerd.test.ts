import { afterEach, describe, expect, it, vi } from "vitest";

import { clearLineAndHomeCursor, clearScreenAndHomeCursor, resetTerminal } from "../../src/clear";
import { clearClipboard, setClipboard } from "../../src/clipboard";
import { APC, BEL, CSI, ESC, OSC, ST } from "../../src/constants";
import { cursorMove, cursorRestore, cursorSave, cursorTo, cursorUp } from "../../src/cursor";
import { eraseDisplay, EraseDisplayMode, eraseInLine, EraseLineMode, eraseLines } from "../../src/erase";
import { isTerminalApp, isWindows } from "../../src/helpers";
import hyperlink from "../../src/hyperlink";
import { image } from "../../src/image";
import kittyGraphics from "../../src/kitty-graphics";
import strip from "../../src/strip";
import { encodeBase64Bytes, encodeBase64String } from "../../src/utils/base64";

describe("ansi base64 encoding (workerd)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should encode bytes and strings with the runtime default", () => {
        expect.assertions(3);

        expect(encodeBase64Bytes(new Uint8Array([1, 2, 3]))).toBe("AQID");
        expect(encodeBase64String("foo")).toBe("Zm9v");
        expect(encodeBase64String("café")).toBe("Y2Fmw6k=");
    });

    it("should encode via btoa when Buffer is unavailable", () => {
        expect.assertions(2);

        const globalScope = globalThis as { Buffer?: unknown };
        const original = globalScope.Buffer;

        // A worker without the `nodejs_compat` flag has `btoa` but no `Buffer`.
        Reflect.deleteProperty(globalScope, "Buffer");

        try {
            expect(encodeBase64Bytes(new Uint8Array([1, 2, 3]))).toBe("AQID");
            expect(encodeBase64String("café")).toBe("Y2Fmw6k=");
        } finally {
            globalScope.Buffer = original;
        }
    });

    it("should encode via Buffer when neither toBase64 nor btoa exist", () => {
        expect.assertions(1);

        const prototype = Uint8Array.prototype as unknown as { toBase64?: unknown };
        const hadToBase64 = "toBase64" in prototype;
        const originalToBase64 = prototype.toBase64;

        Reflect.deleteProperty(prototype, "toBase64");
        vi.stubGlobal("btoa", undefined);

        try {
            expect(encodeBase64Bytes(new Uint8Array([1, 2, 3]))).toBe("AQID");
        } finally {
            if (hadToBase64) {
                prototype.toBase64 = originalToBase64;
            }
        }
    });

    it("should encode 8-bit bytes without Latin-1 corruption", () => {
        expect.assertions(1);

        // Every byte value must survive the `btoa` path, which is charCode-based.
        const bytes = new Uint8Array(256);

        for (let index = 0; index < 256; index += 1) {
            bytes[index] = index;
        }

        expect(encodeBase64Bytes(bytes)).toHaveLength(344);
    });
});

describe("ansi process-dependent constants (workerd)", () => {
    it("should report a non-Windows, non-Terminal.app environment", () => {
        expect.assertions(2);

        // workerd reports `process.platform === "linux"` and sets no TERM_PROGRAM.
        expect(isWindows).toBe(false);
        expect(isTerminalApp).toBe(false);
    });

    it("should pick the full-reset variant of resetTerminal", () => {
        expect.assertions(1);

        expect(resetTerminal).toBe(`${CSI}2J${CSI}3J${CSI}H${ESC}c`);
    });

    it("should pick the ANSI cursor save and restore variants", () => {
        expect.assertions(2);

        expect(cursorSave).toBe(`${ESC}s`);
        expect(cursorRestore).toBe(`${ESC}u`);
    });
});

describe("ansi helpers module under a minimal process shim (workerd)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("should load when process exists but exposes no env", async () => {
        expect.assertions(2);

        vi.resetModules();
        vi.stubGlobal("process", {});

        const helpers = await import("../../src/helpers");

        expect(helpers.isWindows).toBe(false);
        expect(helpers.isTerminalApp).toBe(false);
    });

    it("should load when there is no process global at all", async () => {
        expect.assertions(2);

        vi.resetModules();
        vi.stubGlobal("process", undefined);

        const helpers = await import("../../src/helpers");

        expect(helpers.isWindows).toBe(false);
        expect(helpers.isTerminalApp).toBe(false);
    });
});

describe("ansi cursor and erase builders (workerd)", () => {
    it("should build cursor sequences", () => {
        expect.assertions(3);

        expect(cursorTo(0, 0)).toBe(`${CSI}1;1H`);
        expect(cursorUp(3)).toBe(`${CSI}3A`);
        expect(cursorMove(2, -1)).toBe(`${CSI}2C${CSI}1A`);
    });

    it("should build erase sequences", () => {
        expect.assertions(3);

        expect(eraseDisplay(EraseDisplayMode.EntireScreen)).toBe(`${CSI}2J`);
        expect(eraseInLine(EraseLineMode.EntireLine)).toBe(`${CSI}2K`);
        expect(eraseLines(0)).toBe("");
    });

    it("should build the composed clear sequences", () => {
        expect.assertions(2);

        expect(clearScreenAndHomeCursor).toBe(`${CSI}H${CSI}2J`);
        expect(clearLineAndHomeCursor).toBe(`${CSI}2K${CSI}G`);
    });
});

describe("ansi OSC builders (workerd)", () => {
    it("should build a hyperlink", () => {
        expect.assertions(1);

        expect(hyperlink("Visulima", "https://visulima.com")).toBe(`${OSC}8;;https://visulima.com${BEL}Visulima${OSC}8;;${BEL}`);
    });

    it("should strip injected OSC terminators from a hyperlink", () => {
        expect.assertions(1);

        expect(hyperlink("text", `https://a.example${BEL}${ESC}]0;pwn`)).toBe(`${OSC}8;;https://a.example]0;pwn${BEL}text${OSC}8;;${BEL}`);
    });

    it("should build an inline image without Node Buffer", () => {
        expect.assertions(2);

        const globalScope = globalThis as { Buffer?: unknown };
        const original = globalScope.Buffer;

        Reflect.deleteProperty(globalScope, "Buffer");

        try {
            expect(image(new Uint8Array([1, 2, 3]))).toBe(`${OSC}1337;File=inline=1:AQID${BEL}`);
            expect(image(new Uint8Array([1, 2, 3]), { height: "30%", width: 10 })).toBe(`${OSC}1337;File=inline=1;width=10;height=30%:AQID${BEL}`);
        } finally {
            globalScope.Buffer = original;
        }
    });

    it("should build clipboard sequences", () => {
        expect.assertions(3);

        expect(setClipboard("foo")).toBe(`${OSC}52;c;Zm9v${BEL}`);
        expect(setClipboard("foo", "c", ST)).toBe(`${OSC}52;c;Zm9v${ST}`);
        expect(clearClipboard()).toBe(`${OSC}52;c;${BEL}`);
    });

    it("should build a kitty graphics frame", () => {
        expect.assertions(2);

        expect(kittyGraphics("AQID", "a=T", "f=100")).toBe(`${APC}Ga=T,f=100;AQID${ST}`);
        expect(kittyGraphics("", "a=d")).toBe(`${APC}Ga=d${ST}`);
    });
});

describe("ansi barrel entry (workerd)", () => {
    it("should load every module through the index barrel", async () => {
        expect.assertions(4);

        // The barrel pulls in every module, so a single `node:*` import or an
        // unguarded `process` dereference anywhere would fail this import.
        const index = await import("../../src/index");

        expect(index.beep).toBeTypeOf("string");
        expect(index.RIS).toBeTypeOf("string");
        expect(index.cursorTo).toBeTypeOf("function");
        expect(Object.keys(index).length).toBeGreaterThan(100);
    });
});

describe("ansi strip (workerd)", () => {
    it("should strip SGR, OSC and APC sequences", () => {
        expect.assertions(3);

        expect(strip(`${CSI}31mfoo${CSI}39m`)).toBe("foo");
        expect(strip(hyperlink("Visulima", "https://visulima.com"))).toBe("Visulima");
        expect(strip(kittyGraphics("AQID", "a=T"))).toBe("");
    });

    it("should leave plain text untouched", () => {
        expect.assertions(1);

        expect(strip("plain 🎉")).toBe("plain 🎉");
    });
});
