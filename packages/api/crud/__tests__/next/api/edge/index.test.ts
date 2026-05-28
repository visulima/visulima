import { describe, expect, it, vi } from "vitest";

import edgeHandler from "../../../../src/next/api/edge";
import type { Adapter, ParsedQueryParameters } from "../../../../src/types";

const buildAdapter = (): Adapter<any, any> => {
    return {
        connect: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
        disconnect: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue([{ id: 1 }]),
        getModels: () => ["users"],
        getOne: vi.fn().mockResolvedValue({}),
        getPaginationData: vi.fn().mockResolvedValue({ page: 1, pageCount: 1, total: 1 }),
        init: vi.fn().mockResolvedValue(undefined),
        parseQuery: vi.fn().mockImplementation((_n, q) => q as ParsedQueryParameters),
        update: vi.fn().mockResolvedValue({}),
    };
};

describe(edgeHandler, () => {
    it("should execute baseHandler with Response.json executor", async () => {
        expect.assertions(1);

        const adapter = buildAdapter();
        const handler = await edgeHandler(adapter);

        const request = {
            headers: { host: "example.com" },
            method: "GET",
            url: "/users",
        } as unknown as Request;

        await handler(request, undefined);

        expect(adapter.getAll).toHaveBeenCalledTimes(1);
    });
});
