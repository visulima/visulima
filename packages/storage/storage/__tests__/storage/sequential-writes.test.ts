import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const storageDirectory = join(import.meta.dirname, "../../src/storage");

const sourcesMatching = async (pattern: RegExp): Promise<string[]> => {
    const entries = await readdir(storageDirectory, { recursive: true, withFileTypes: true });
    const matching: string[] = [];

    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".ts")) {
            const path = join(entry.parentPath, entry.name);

            if (pattern.test(await readFile(path, "utf8"))) {
                matching.push(path.slice(storageDirectory.length + 1));
            }
        }
    }

    return matching.toSorted();
};

describe("sequentialWrites", () => {
    // `sequentialWrites` makes chunked uploads trust `bytesWritten` as the stored prefix. Declared
    // on an adapter that writes at any offset, an upload with holes would be reported complete,
    // so the flag must stay on exactly the adapters that reject out-of-order writes.
    // The recursive scan over the adapter sources runs just over vitest's 5s
    // default on the Windows CI runner.
    it("should be declared by exactly the adapters that enforce contiguous writes", { timeout: 30_000 }, async () => {
        expect.assertions(1);

        const declaring = await sourcesMatching(/readonly sequentialWrites: boolean = true/u);
        const enforcing = await sourcesMatching(/this\.assertContiguousWrite\(/u);

        expect(declaring).toStrictEqual(enforcing);
    });
});
