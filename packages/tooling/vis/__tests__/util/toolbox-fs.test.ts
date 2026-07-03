import { describe, expect, it, vi } from "vitest";

import { pathExists, readJsonFile, removeFile, writeJsonFile } from "../../src/util/toolbox-fs";

const makeFakeFs = () => {
    return {
        access: vi.fn<() => Promise<void>>(),
        mkdir: vi.fn<() => Promise<string | undefined>>(),
        readdir: vi.fn<() => Promise<string[]>>(),
        readFile: vi.fn<() => Promise<string>>(),
        rm: vi.fn<() => Promise<void>>(),
        stat: vi.fn<() => Promise<{ isDirectory: () => boolean; isFile: () => boolean }>>(),
        writeFile: vi.fn<() => Promise<void>>(),
    };
};

describe("toolbox-fs helpers", () => {
    describe(pathExists, () => {
        it("returns true when fs.access resolves", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.access).mockResolvedValue(undefined);

            await expect(pathExists(fs, "/some/path")).resolves.toBe(true);
        });

        it("returns false when fs.access rejects", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

            await expect(pathExists(fs, "/no/such/file")).resolves.toBe(false);
        });
    });

    describe(readJsonFile, () => {
        it("parses JSON returned by readFile", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.readFile).mockResolvedValue("{\"a\":1,\"b\":true}");

            const result = await readJsonFile<{ a: number; b: boolean }>(fs, "/config.json");

            expect(result).toStrictEqual({ a: 1, b: true });
        });

        it("throws on invalid JSON", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.readFile).mockResolvedValue("not-json");

            await expect(readJsonFile(fs, "/bad.json")).rejects.toThrow(SyntaxError);
        });

        it("includes the file path in the error message", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.readFile).mockResolvedValue("not-json");

            await expect(readJsonFile(fs, "/some/dir/bad.json")).rejects.toThrow("/some/dir/bad.json");
        });

        it("preserves the original error as cause", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.readFile).mockResolvedValue("{ broken");

            const error = await readJsonFile(fs, "/bad.json").catch((error_: unknown) => error_);

            expect((error as { cause?: unknown }).cause).toBeInstanceOf(SyntaxError);
        });
    });

    describe(writeJsonFile, () => {
        it("writes JSON with a trailing newline using the given indent", async () => {
            expect.assertions(3);

            const fs = makeFakeFs();

            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            await writeJsonFile(fs, "/out.json", { x: 1 }, 2);

            const [path, content, encoding] = vi.mocked(fs.writeFile).mock.calls[0] as [string, string, BufferEncoding];

            expect(path).toBe("/out.json");
            expect(content).toBe(`${JSON.stringify({ x: 1 }, undefined, 2)}\n`);
            expect(encoding).toBe("utf8");
        });

        it("uses indent=4 by default", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            await writeJsonFile(fs, "/out.json", { y: 2 });

            const [, content] = vi.mocked(fs.writeFile).mock.calls[0] as [string, string, BufferEncoding];

            expect(content).toBe(`${JSON.stringify({ y: 2 }, undefined, 4)}\n`);
        });
    });

    describe(removeFile, () => {
        it("calls fs.rm with force:true", async () => {
            expect.assertions(1);

            const fs = makeFakeFs();

            vi.mocked(fs.rm).mockResolvedValue(undefined);

            await removeFile(fs, "/to/delete.txt");

            expect(fs.rm).toHaveBeenCalledExactlyOnceWith("/to/delete.txt", { force: true });
        });
    });
});
