import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import readFile from "../../../src/read/read-file";
import readdirSync from "../../../src/read/read-file-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-file");

const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

describe.each([
    ["readFile", readFile],
    ["readFileSync", readdirSync],
])(`%s`, (name: string, function_) => {
    it("should read", async () => {
        expect.assertions(1);

        const result = await function_(join(fixturePath, "text.md"));

        expect(result).toBe(`hello world!${isWindows ? "\r\n" : "\n"}`);
    });

    it("should read buffer", async () => {
        expect.assertions(1);

        const result = await function_(join(fixturePath, "text.md"), { buffer: true });

        expect(result?.toString()).toBe(`hello world!${isWindows ? "\r\n" : "\n"}`);
    });

    it("should throw a error on a missing file", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_("/missing")).rejects.toThrow("EPERM: Operation not permitted, unable to read the non-accessible file: /missing");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_("/missing")).toThrow("EPERM: Operation not permitted, unable to read the non-accessible file: /missing");
        }
    });

    it("should read gzip file", async () => {
        expect.assertions(1);

        const result = await function_(join(fixturePath, "text.md.gz"), { compression: "gzip" });

        expect(result).toBe("hello world!");
    });

    it("should read brotli file", async () => {
        expect.assertions(1);

        const result = await function_(join(fixturePath, "note.md.br"), { compression: "brotli" });

        expect(result).toBe("hello world!");
    });

    it("should read invalid compression", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(join(fixturePath, "text.md.gz"), { compression: "brotli" })).rejects.toThrow("Decompression failed");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(join(fixturePath, "text.md.gz"), { compression: "brotli" })).toThrow("Decompression failed");
        }
    });
});
