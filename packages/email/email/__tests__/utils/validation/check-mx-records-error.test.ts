import { resolveMx } from "node:dns/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkMxRecords } from "../../../src/utils/validation/check-mx-records";

vi.mock(import("node:dns/promises"), () => {
    return {
        resolveMx: vi.fn(),
    };
});

const resolveMxMock = resolveMx as unknown as ReturnType<typeof vi.fn>;

describe("checkMxRecords - non-Error rejection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should stringify a rejection value that is not an Error", async () => {
        expect.assertions(2);

        resolveMxMock.mockRejectedValueOnce("dns exploded");

        const result = await checkMxRecords("example.com");

        expect(result.valid).toBe(false);
        expect(result.error).toBe("dns exploded");
    });
});
