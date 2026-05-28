import { describe, expect, it, vi } from "vitest";

import nodeHandler from "../../../../src/next/api/node";
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

describe(nodeHandler, () => {
    it("should call response.status(...).send(...) and response.end()", async () => {
        expect.assertions(4);

        const adapter = buildAdapter();
        const handler = await nodeHandler(adapter);

        const send = vi.fn();
        const end = vi.fn();
        const status = vi.fn().mockReturnValue({ send });

        const request = {
            headers: { host: "example.com" },
            method: "GET",
            url: "/users",
        } as any;

        const response = { end, status } as any;

        await handler(request, response);

        expect(adapter.getAll).toHaveBeenCalledTimes(1);
        expect(status).toHaveBeenCalledWith(200);
        expect(send).toHaveBeenCalledWith([{ id: 1 }]);
        expect(end).toHaveBeenCalledTimes(1);
    });
});
