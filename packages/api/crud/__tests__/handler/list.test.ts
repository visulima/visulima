import { describe, expect, it, vi } from "vitest";

import listHandler from "../../src/handler/list";
import type { Adapter, ParsedQueryParameters } from "../../src/types";

describe(listHandler, () => {
    it("should return raw list when no pagination requested", async () => {
        expect.assertions(3);

        const items = [{ id: 1 }, { id: 2 }];
        const adapter = {
            getAll: vi.fn<Adapter<any, any>["getAll"]>().mockResolvedValue(items),
            getPaginationData: vi.fn<Adapter<any, any>["getPaginationData"]>(),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        const result = await listHandler({
            adapter,
            pagination: { perPage: 20 },
            query: {},
            resourceName: "users",
        });

        expect(adapter.getAll).toHaveBeenCalledWith("users", {});
        expect(adapter.getPaginationData).not.toHaveBeenCalled();
        expect(result).toStrictEqual({ data: items, status: 200 });
    });

    it("should return paginated payload when page query is set", async () => {
        expect.assertions(3);

        const items = [{ id: 11 }, { id: 12 }];
        const adapter = {
            getAll: vi.fn<Adapter<any, any>["getAll"]>().mockResolvedValue(items),
            getPaginationData: vi.fn<Adapter<any, any>["getPaginationData"]>().mockResolvedValue({
                page: 2,
                pageCount: 5,
                total: 10,
            }),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        const query: ParsedQueryParameters = { limit: 2, page: 2 };

        const result = (await listHandler({
            adapter,
            pagination: { perPage: 20 },
            query,
            resourceName: "users",
        })) as { data: { data: unknown[]; meta: Record<string, unknown> }; status: number };

        // listHandler mutates query.skip/take
        expect(query.skip).toBe(2);
        expect((query as { take?: number }).take).toBe(2);
        expect(result.data.data).toStrictEqual(items);
    });

    it("should use config perPage when query.limit is missing", async () => {
        expect.assertions(2);

        const items = [{ id: 1 }];
        const adapter = {
            getAll: vi.fn<Adapter<any, any>["getAll"]>().mockResolvedValue(items),
            getPaginationData: vi.fn<Adapter<any, any>["getPaginationData"]>().mockResolvedValue({
                page: 1,
                pageCount: 1,
                total: 1,
            }),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        const query: ParsedQueryParameters = { page: 1 };

        await listHandler({
            adapter,
            pagination: { perPage: 5 },
            query,
            resourceName: "users",
        });

        expect((query as { take?: number }).take).toBe(5);
        expect(query.skip).toBe(0);
    });

    it("should throw when page query is zero or negative", async () => {
        expect.assertions(1);

        const adapter = {
            getAll: vi.fn<Adapter<any, any>["getAll"]>(),
            getPaginationData: vi.fn<Adapter<any, any>["getPaginationData"]>(),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        await expect(
            listHandler({
                adapter,
                pagination: { perPage: 20 },
                query: { page: 0 },
                resourceName: "users",
            }),
        ).rejects.toThrow("page query must be a strictly positive number");
    });
});
