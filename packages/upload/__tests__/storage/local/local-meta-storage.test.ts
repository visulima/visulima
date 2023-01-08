import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
    afterEach, beforeEach, describe, expect, it,
} from "vitest";

import LocalMetaStorage from "../../../src/storage/local/local-meta-storage";
import { metafile, testRoot as uploadRoot } from "../../__helpers__/config";
import { cleanup } from "../../__helpers__/utils";

describe("LocalMetaStorage", () => {
    const testRoot = join(uploadRoot, "local-meta-storage");

    beforeEach(() => cleanup(testRoot));

    afterEach(() => cleanup(testRoot));

    it("defaults", () => {
        const meta = new LocalMetaStorage({ directory: testRoot });
        const metaPath = meta.getMetaPath(metafile.id);

        expect(basename(metaPath)).toBe(`${metafile.id}.META`);
        expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
    });

    it("custom", () => {
        const meta = new LocalMetaStorage({
            prefix: ".",
            suffix: ".",
            directory: join(tmpdir(), "meta"),
        });

        const metaPath = meta.getMetaPath(metafile.id);

        expect(basename(metaPath)).toBe(`.${metafile.id}.`);
        expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
    });
});
