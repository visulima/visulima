import { rm } from "node:fs/promises";
import { basename } from "node:path";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import LocalMetaStorage from "../../../src/storage/local/local-meta-storage";
import { metafile } from "../../__helpers__/config";

describe(LocalMetaStorage, () => {
    let testRoot: string;

    beforeEach(async () => {
        testRoot = temporaryDirectory();
    });

    afterEach(async () => {
        try {
            await rm(testRoot, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    it("should use default prefix and suffix for metadata file paths", () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({ directory: testRoot });
        const metaPath = meta.getMetaPath(metafile.id);

        expect(basename(metaPath)).toBe(`${metafile.id}.META`);
        expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
    });

    it("should use custom prefix and suffix for metadata file paths", () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({
            directory: testRoot,
            prefix: ".",
            suffix: ".",
        });

        const metaPath = meta.getMetaPath(metafile.id);

        expect(basename(metaPath)).toBe(`.${metafile.id}.`);
        expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
    });
});
