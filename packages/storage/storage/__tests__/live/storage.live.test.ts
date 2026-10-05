import { afterEach, beforeEach, describe, vi } from "vitest";

import { describeMatrix } from "../__helpers__/matrix";
import type { StorageContractScenario } from "../__helpers__/storage-contract";
import { describeStorageContract } from "../__helpers__/storage-contract";
import type { LiveBackend } from "./backends";
import { LIVE, LIVE_PROVIDERS } from "./backends";

// The contract ages an upload by faking the clock, so its requests are signed hours off and an S3
// service refuses them (RequestTimeTooSkewed). The matrix below checks expiry against these services
// by ageing the upload's record instead.
const SIGNED_WITH_FAKE_CLOCK = "requests signed with a faked clock are refused as skewed";

/** Contract scenarios a real service can't run, with the reason. */
const CONTRACT_SKIPS: Record<string, Partial<Record<StorageContractScenario, string>>> = {
    "aws-light (MinIO)": { "expired upload": SIGNED_WITH_FAKE_CLOCK, "failing meta store": SIGNED_WITH_FAKE_CLOCK, purge: SIGNED_WITH_FAKE_CLOCK },
    // fake-gcs-server answers the resumable-session status query (`Content-Range: bytes */N`) with
    // 200 and an off-by-one Range, where GCS answers 308; the GCS fake covers resume instead.
    "gcs (fake-gcs-server)": { "resume across processes": "fake-gcs-server does not emulate the resumable session status query" },
    "s3 (MinIO)": { "expired upload": SIGNED_WITH_FAKE_CLOCK, purge: SIGNED_WITH_FAKE_CLOCK },
};

describe.runIf(LIVE).each(Object.entries(LIVE_PROVIDERS))("%s (live)", (name, provider) => {
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
        }, CONTRACT_SKIPS[name]);
    });

    // The upload handlers end to end over real HTTP, on a slice of the matrix the fakes run in full.
    describeMatrix({ ...provider, only: { expirations: ["none", "maxAge"], metas: ["provider meta"], runtimes: ["node"] } });
});
