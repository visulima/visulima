import { describe, expect, it } from "vitest";

import type { OrderByField } from "../../../../src";
import type { PrismaOrderBy } from "../../../../src/adapter/prisma/types";
import parsePrismaOrderBy from "../../../../src/adapter/prisma/utils/parse-order-by";

describe("parse prisma orderBy", () => {
    it("should map correctly operators", () => {
        expect.assertions(1);

        const baseQuery: OrderByField = {
            id: "$desc",
            username: "$asc",
        };

        expect(parsePrismaOrderBy(baseQuery)).toStrictEqual<PrismaOrderBy>({
            id: "desc",
            username: "asc",
        });
    });
});
