import { PassThrough } from "node:stream";

import { describe, expect, expectTypeOf, it } from "vitest";

import { clearOsc52, isOsc52Supported, writeOsc52 } from "../../src/ink/clipboard";

describe("clipboard utilities", () => {
    describe(writeOsc52, () => {
        it("should write correct OSC 52 sequence for clipboard target", () => {
            expect.assertions(1);

            const stream = new PassThrough();
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => chunks.push(chunk));

            writeOsc52(stream, "hello", "c");

            const output = Buffer.concat(chunks).toString();
            const expectedBase64 = Buffer.from("hello", "utf8").toString("base64");

            expect(output).toBe(`\u001B]52;c;${expectedBase64}\u0007`);
        });

        it("should write correct sequence for primary selection", () => {
            expect.assertions(1);

            const stream = new PassThrough();
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => chunks.push(chunk));

            writeOsc52(stream, "test", "p");

            const output = Buffer.concat(chunks).toString();

            expect(output).toContain(";p;");
        });

        it("should handle empty text", () => {
            expect.assertions(1);

            const stream = new PassThrough();
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => chunks.push(chunk));

            writeOsc52(stream, "", "c");

            const output = Buffer.concat(chunks).toString();

            expect(output).toBe(`\u001B]52;c;${Buffer.from("").toString("base64")}\u0007`);
        });

        it("should handle Unicode text", () => {
            expect.assertions(1);

            const stream = new PassThrough();
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => chunks.push(chunk));

            writeOsc52(stream, "日本語", "c");

            const output = Buffer.concat(chunks).toString();
            const expectedBase64 = Buffer.from("日本語", "utf8").toString("base64");

            expect(output).toContain(expectedBase64);
        });

        it("should reject invalid targets at runtime", () => {
            expect.assertions(1);

            const stream = new PassThrough();

            expect(() => {
                writeOsc52(stream, "test", "x" as any);
            }).toThrow("Invalid clipboard target");
        });
    });

    describe(clearOsc52, () => {
        it("should write empty payload for clipboard", () => {
            expect.assertions(1);

            const stream = new PassThrough();
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => chunks.push(chunk));

            clearOsc52(stream, "c");

            const output = Buffer.concat(chunks).toString();

            expect(output).toBe("\u001B]52;c;\u0007");
        });

        it("should support secondary selection", () => {
            expect.assertions(1);

            const stream = new PassThrough();
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => chunks.push(chunk));

            clearOsc52(stream, "s");

            const output = Buffer.concat(chunks).toString();

            expect(output).toContain(";s;");
        });
    });

    describe(isOsc52Supported, () => {
        it("should detect known terminals", () => {
            expect.assertions(3);

            const original = process.env["TERM_PROGRAM"];

            process.env["TERM_PROGRAM"] = "kitty";

            expect(isOsc52Supported()).toBe(true);

            process.env["TERM_PROGRAM"] = "Alacritty";

            expect(isOsc52Supported()).toBe(true);

            process.env["TERM_PROGRAM"] = "WezTerm";

            expect(isOsc52Supported()).toBe(true);

            if (original === undefined) {
                delete process.env["TERM_PROGRAM"];
            } else {
                process.env["TERM_PROGRAM"] = original;
            }
        });

        it("should detect xterm via TERM", () => {
            expect.assertions(1);

            const originalProgram = process.env["TERM_PROGRAM"];
            const originalTerm = process.env["TERM"];

            process.env["TERM_PROGRAM"] = "";
            process.env["TERM"] = "xterm-256color";

            expect(isOsc52Supported()).toBe(true);

            if (originalProgram === undefined) {
                delete process.env["TERM_PROGRAM"];
            } else {
                process.env["TERM_PROGRAM"] = originalProgram;
            }

            if (originalTerm === undefined) {
                delete process.env["TERM"];
            } else {
                process.env["TERM"] = originalTerm;
            }
        });

        // eslint-disable-next-line vitest/prefer-expect-assertions -- type-only assertion via expectTypeOf
        it("should return boolean for unknown terminals", () => {
            const original = process.env["TERM_PROGRAM"];

            process.env["TERM_PROGRAM"] = "totally-unknown";

            expectTypeOf(isOsc52Supported()).toBeBoolean();

            if (original === undefined) {
                delete process.env["TERM_PROGRAM"];
            } else {
                process.env["TERM_PROGRAM"] = original;
            }
        });
    });
});
