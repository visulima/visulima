import { describe, expect, it } from "vitest";

import type { OrderByField } from "../../../../src";
import type { PrismaOrderBy } from "../../../../src/adapter/prisma/types";
import parsePrismaOrderBy from "../../../../src/adapter/prisma/utils/parse-order-by";

describe("Parse prisma orderBy", () => {
    it("should map correctly operators", () => {
        const baseQuery: OrderByField = {
            username: "$asc",
            id: "$desc",
        };

        expect(parsePrismaOrderBy(baseQuery)).toEqual<PrismaOrderBy>({
            username: "asc",
            id: "desc",
        });
    });
});
