import { describe, expect, it } from "vitest";

import RangeChecksum from "../../src/utils/range-checksum";
import RangeHasher from "../../src/utils/range-hasher";

describe("utils", () => {
    describe(RangeChecksum, () => {
        it("should generate correct SHA-1 digest for empty content", () => {
            expect.assertions(1);

            const rangeChecksum = new RangeChecksum(new RangeHasher(), "/test");

            expect(rangeChecksum.digest()).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
        });
    });
});
