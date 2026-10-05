import { describe, expect, it } from "vitest";

import { getContiguousEnd, isUploadComplete, normalizeRanges, trackChunk } from "../../src/utils/chunked-upload";

describe(normalizeRanges, () => {
    it.each([
        [
            "keeps ranges apart across a gap",
            [
                { length: 10, offset: 0 },
                { length: 10, offset: 20 },
            ],
            [
                { length: 10, offset: 0 },
                { length: 10, offset: 20 },
            ],
        ],
        [
            "joins adjacent ranges",
            [
                { length: 10, offset: 0 },
                { length: 10, offset: 10 },
            ],
            [{ length: 20, offset: 0 }],
        ],
        [
            "joins overlapping ranges",
            [
                { length: 10, offset: 0 },
                { length: 10, offset: 5 },
            ],
            [{ length: 15, offset: 0 }],
        ],
        [
            "sorts by offset first",
            [
                { length: 10, offset: 10 },
                { length: 10, offset: 0 },
            ],
            [{ length: 20, offset: 0 }],
        ],
        [
            "drops a range another covers",
            [
                { length: 10, offset: 0 },
                { length: 5, offset: 2 },
            ],
            [{ length: 10, offset: 0 }],
        ],
        ["drops fields other than offset and length", [{ checksum: "a", length: 10, offset: 0 }], [{ length: 10, offset: 0 }]],
    ])("%s", (_, chunks, expected) => {
        expect.assertions(1);

        expect(normalizeRanges(chunks)).toStrictEqual(expected);
    });

    it("does not change the array it is given", () => {
        expect.assertions(1);

        const chunks = [
            { length: 10, offset: 10 },
            { length: 10, offset: 0 },
        ];

        normalizeRanges(chunks);

        expect(chunks).toStrictEqual([
            { length: 10, offset: 10 },
            { length: 10, offset: 0 },
        ]);
    });
});

describe(trackChunk, () => {
    it("closes the gap between two ranges", () => {
        expect.assertions(1);

        expect(
            trackChunk(
                [
                    { length: 10, offset: 0 },
                    { length: 10, offset: 20 },
                ],
                { length: 10, offset: 10 },
            ),
        ).toStrictEqual([{ length: 30, offset: 0 }]);
    });
});

describe("stored prefix", () => {
    // A record saved before ranges were merged lists one entry per chunk, in any order.
    const perChunk = [
        { length: 10, offset: 20 },
        { length: 10, offset: 0 },
        { length: 10, offset: 10 },
    ];

    it("reads the prefix from per-chunk and merged lists alike", () => {
        expect.assertions(3);

        expect(getContiguousEnd(perChunk)).toBe(30);
        expect(getContiguousEnd([{ length: 10, offset: 5 }])).toBe(0);
        expect(getContiguousEnd([])).toBe(0);
    });

    it("is complete only when the prefix covers the file", () => {
        expect.assertions(3);

        expect(isUploadComplete(perChunk, 30)).toBe(true);
        expect(
            isUploadComplete(
                [
                    { length: 10, offset: 0 },
                    { length: 10, offset: 20 },
                ],
                30,
            ),
        ).toBe(false);
        expect(isUploadComplete([], 0)).toBe(false);
    });
});
