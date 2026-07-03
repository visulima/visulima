import { describe, expect, it } from "vitest";

import { tokenizeAnsi } from "../../src/ink/ansi-tokenizer";

describe("ansi-tokenizer", () => {
    it("tokenize plain text", () => {
        expect.assertions(1);

        expect(tokenizeAnsi("hello")).toStrictEqual([{ type: "text", value: "hello" }]);
    });

    it("tokenize ESC CSI SGR sequence", () => {
        expect.assertions(7);

        const tokens = tokenizeAnsi("A\u001B[31mB");

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "csi", "text"]);
        expect(tokens[0]).toStrictEqual({ type: "text", value: "A" });
        expect(tokens[2]).toStrictEqual({ type: "text", value: "B" });

        const csiToken = tokens[1];

        if (csiToken?.type !== "csi") {
            expect.fail();

            return;
        }

        expect(csiToken.value).toBe("\u001B[31m");
        expect(csiToken.parameterString).toBe("31");
        expect(csiToken.intermediateString).toBe("");
        expect(csiToken.finalCharacter).toBe("m");
    });

    it("tokenize C1 CSI sequence", () => {
        expect.assertions(4);

        const tokens = tokenizeAnsi("A\u009B2 qB");
        const csiToken = tokens[1];

        if (csiToken?.type !== "csi") {
            expect.fail();

            return;
        }

        expect(csiToken.value).toBe("\u009B2 q");
        expect(csiToken.parameterString).toBe("2");
        expect(csiToken.intermediateString).toBe(" ");
        expect(csiToken.finalCharacter).toBe("q");
    });

    it("tokenize OSC control string with ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u001B]8;;https://example.com\u001B\\B");
        const oscToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "osc", "text"]);

        if (oscToken?.type !== "osc") {
            expect.fail();

            return;
        }

        expect(oscToken.value).toBe("\u001B]8;;https://example.com\u001B\\");
    });

    it("tokenize tmux DCS passthrough as one control string token", () => {
        expect.assertions(3);

        const tokens = tokenizeAnsi("A\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\B");
        const dcsToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "dcs", "text"]);

        if (dcsToken?.type !== "dcs") {
            expect.fail();

            return;
        }

        expect(dcsToken.value.startsWith("\u001BPtmux;")).toBe(true);
        expect(dcsToken.value.endsWith("\u001B\\")).toBe(true);
    });

    it("tokenize incomplete CSI as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u001B[");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u001B[" },
        ]);
    });

    it("tokenize incomplete ESC intermediate sequence as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u001B#");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u001B#" },
        ]);
    });

    it("ignore lone ESC before non-final byte", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u001B\u0007B");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "text", value: "\u0007B" },
        ]);
    });

    it("tokenize ESC ST sequence as ESC token", () => {
        expect.assertions(4);

        const tokens = tokenizeAnsi("A\u001B\\B");
        const escToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "esc", "text"]);

        if (escToken?.type !== "esc") {
            expect.fail();

            return;
        }

        expect(escToken.value).toBe("\u001B\\");
        expect(escToken.intermediateString).toBe("");
        expect(escToken.finalCharacter).toBe("\\");
    });

    it("tokenize C1 OSC with C1 ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u009D8;;https://example.com\u009CB");
        const oscToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "osc", "text"]);

        if (oscToken?.type !== "osc") {
            expect.fail();

            return;
        }

        expect(oscToken.value).toBe("\u009D8;;https://example.com\u009C");
    });

    it("tokenize C1 OSC with ESC ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u009D8;;https://example.com\u001B\\B");
        const oscToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "osc", "text"]);

        if (oscToken?.type !== "osc") {
            expect.fail();

            return;
        }

        expect(oscToken.value).toBe("\u009D8;;https://example.com\u001B\\");
    });

    it("tokenize C1 SGR CSI sequence", () => {
        expect.assertions(5);

        const tokens = tokenizeAnsi("A\u009B31mB");
        const csiToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "csi", "text"]);

        if (csiToken?.type !== "csi") {
            expect.fail();

            return;
        }

        expect(csiToken.value).toBe("\u009B31m");
        expect(csiToken.parameterString).toBe("31");
        expect(csiToken.intermediateString).toBe("");
        expect(csiToken.finalCharacter).toBe("m");
    });

    it("tokenize incomplete C1 CSI as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u009B31");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u009B31" },
        ]);
    });

    it("tokenize incomplete C1 OSC as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u009D8;;https://example.com");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u009D8;;https://example.com" },
        ]);
    });

    it("tokenize DCS with BEL in payload until ST terminator", () => {
        expect.assertions(3);

        const tokens = tokenizeAnsi("A\u001BPpayload\u0007still-payload\u001B\\B");
        const dcsToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "dcs", "text"]);

        if (dcsToken?.type !== "dcs") {
            expect.fail();

            return;
        }

        expect(dcsToken.value).toContain("\u0007");
        expect(dcsToken.value.endsWith("\u001B\\")).toBe(true);
    });

    it("tokenize C1 OSC control string with BEL terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u009D8;;https://example.com\u0007B");
        const oscToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "osc", "text"]);

        if (oscToken?.type !== "osc") {
            expect.fail();

            return;
        }

        expect(oscToken.value).toBe("\u009D8;;https://example.com\u0007");
    });

    it("tokenize ESC SOS control string with ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u001BXpayload\u001B\\B");
        const sosToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "sos", "text"]);

        if (sosToken?.type !== "sos") {
            expect.fail();

            return;
        }

        expect(sosToken.value).toBe("\u001BXpayload\u001B\\");
    });

    it("tokenize ESC SOS control string with C1 ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u001BXpayload\u009CB");
        const sosToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "sos", "text"]);

        if (sosToken?.type !== "sos") {
            expect.fail();

            return;
        }

        expect(sosToken.value).toBe("\u001BXpayload\u009C");
    });

    it("tokenize C1 SOS control string with C1 ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u0098payload\u009CB");
        const sosToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "sos", "text"]);

        if (sosToken?.type !== "sos") {
            expect.fail();

            return;
        }

        expect(sosToken.value).toBe("\u0098payload\u009C");
    });

    it("tokenize C1 SOS control string with ESC ST terminator", () => {
        expect.assertions(2);

        const tokens = tokenizeAnsi("A\u0098payload\u001B\\B");
        const sosToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "sos", "text"]);

        if (sosToken?.type !== "sos") {
            expect.fail();

            return;
        }

        expect(sosToken.value).toBe("\u0098payload\u001B\\");
    });

    it("tokenize ESC SOS with BEL terminator as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u001BXpayload\u0007B");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u001BXpayload\u0007B" },
        ]);
    });

    it("tokenize C1 SOS with BEL terminator as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u0098payload\u0007B");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u0098payload\u0007B" },
        ]);
    });

    it("tokenize incomplete C1 SOS as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u0098payload");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u0098payload" },
        ]);
    });

    it("tokenize incomplete ESC SOS as invalid and stop", () => {
        expect.assertions(1);

        const tokens = tokenizeAnsi("A\u001BXpayload");

        expect(tokens).toStrictEqual([
            { type: "text", value: "A" },
            { type: "invalid", value: "\u001BXpayload" },
        ]);
    });

    it("tokenize SOS with escaped ESC in payload until final ST terminator", () => {
        expect.assertions(3);

        const tokens = tokenizeAnsi("A\u001BXfoo\u001B\u001B\\bar\u001B\\B");
        const sosToken = tokens[1];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "sos", "text"]);

        if (sosToken?.type !== "sos") {
            expect.fail();

            return;
        }

        expect(sosToken.value).toContain("\u001B\u001B\\");
        expect(sosToken.value.endsWith("\u001B\\")).toBe(true);
    });

    it("tokenize standalone C1 controls as c1 tokens", () => {
        expect.assertions(3);

        const tokens = tokenizeAnsi("A\u0085B\u008EC");
        const c1Token1 = tokens[1];
        const c1Token2 = tokens[3];

        expect(tokens.map((token) => token.type)).toStrictEqual(["text", "c1", "text", "c1", "text"]);

        if (c1Token1?.type !== "c1") {
            expect.fail();

            return;
        }

        if (c1Token2?.type !== "c1") {
            expect.fail();

            return;
        }

        expect(c1Token1.value).toBe("\u0085");
        expect(c1Token2.value).toBe("\u008E");
    });
});
