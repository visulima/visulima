import { describe, expect, it } from "vitest";

import { trackChunk } from "../../src/utils/chunked-upload";

describe(trackChunk, () => {
    it.each([
        [
            "appends a chunk after a gap",
            [{ length: 10, offset: 0 }],
            { length: 10, offset: 20 },
            [
                { length: 10, offset: 0 },
                { length: 10, offset: 20 },
            ],
        ],
        ["merges an adjacent chunk", [{ length: 10, offset: 0 }], { length: 10, offset: 10 }, [{ length: 20, offset: 0 }]],
        ["merges an overlapping chunk", [{ length: 10, offset: 0 }], { length: 10, offset: 5 }, [{ length: 15, offset: 0 }]],
        ["merges a chunk that arrives before its neighbour", [{ length: 10, offset: 10 }], { length: 10, offset: 0 }, [{ length: 20, offset: 0 }]],
        [
            "closes a gap between two ranges",
            [
                { length: 10, offset: 0 },
                { length: 10, offset: 20 },
            ],
            { length: 10, offset: 10 },
            [{ length: 30, offset: 0 }],
        ],
        [
            "keeps a range a chunk falls inside",
            [{ checksum: "a", length: 10, offset: 0 }],
            { length: 5, offset: 2 },
            [{ checksum: "a", length: 10, offset: 0 }],
        ],
        [
            "drops the checksum of a range it extends",
            [{ checksum: "a", length: 10, offset: 0 }],
            { checksum: "b", length: 10, offset: 10 },
            [{ length: 20, offset: 0 }],
        ],
        [
            "updates the checksum of an identical chunk",
            [{ checksum: "a", length: 10, offset: 0 }],
            { checksum: "b", length: 10, offset: 0 },
            [{ checksum: "b", length: 10, offset: 0 }],
        ],
        [
            "keeps the checksum when an identical chunk has none",
            [{ checksum: "a", length: 10, offset: 0 }],
            { length: 10, offset: 0 },
            [{ checksum: "a", length: 10, offset: 0 }],
        ],
    ])("%s", (_, chunks, chunk, expected) => {
        expect.assertions(1);

        expect(trackChunk(chunks, chunk)).toStrictEqual(expected);
    });

    it("does not change the array it is given", () => {
        expect.assertions(1);

        const chunks = [{ length: 10, offset: 0 }];

        trackChunk(chunks, { length: 10, offset: 10 });

        expect(chunks).toStrictEqual([{ length: 10, offset: 0 }]);
    });
});
