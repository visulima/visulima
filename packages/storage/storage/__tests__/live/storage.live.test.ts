import { afterEach, beforeEach, describe, vi } from "vitest";

import { describeMatrix } from "../__helpers__/matrix";
import { describeStorageContract } from "../__helpers__/storage-contract";
import type { LiveBackend } from "./backends";
import { LIVE, LIVE_PROVIDERS } from "./backends";

describe.runIf(LIVE).each(Object.entries(LIVE_PROVIDERS))("%s (live)", (_name, provider) => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("against the service", () => {
        let backend: LiveBackend;

        beforeEach(async () => {
            backend = await provider.setup();
        });

        afterEach(async () => {
            await backend.cleanup?.();
        });

        describeStorageContract(() => {
            return {
                createStorage: (options) => backend.createStorage(options ?? {}),
                failBackend: (failing) => backend.failBackend(failing),
                hasObject: async (key) => backend.hasObject(key),
                putObject: async (key, content) => backend.putObject(key, content),
            };
        }, provider.contractSkips);
    });

    // The upload handlers end to end over real HTTP, on a slice of the matrix the fakes run in full.
    describeMatrix({ ...provider, only: { expirations: ["none", "maxAge"], metas: ["provider meta"], runtimes: ["node"] } });
});
