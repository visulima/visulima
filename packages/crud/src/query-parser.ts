import { URL } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import { setProperty } from "dot-prop";

import type { OrderByField, ParsedQueryParameters, RecursiveField, WhereField } from "./types";

const parseRecursive = (select: string): RecursiveField => {
    const selectFields: RecursiveField = {};

    const fields = select.split(",");

    fields.forEach((field) => {
        setProperty(selectFields, field, true);
    });

    return selectFields;
};

const parseWhere = (where: string): WhereField => {
    const whereObject = JSON.parse(where);
    const parsed: WhereField = {};

    Object.keys(whereObject).forEach((key) => {
        setProperty(parsed, key, whereObject[key]);
    });

    return parsed;
};

const parseOrderBy = (orderBy: string): OrderByField => {
    const parsed: OrderByField = {};
    const orderByObject = JSON.parse(orderBy);

    if (Object.keys(orderByObject).length > 0) {
        const key = Object.keys(orderByObject)[0] as string;

        if (orderByObject[key as keyof typeof orderByObject] === "$asc" || orderByObject[key as keyof typeof orderByObject] === "$desc") {
            parsed[key] = orderByObject[key as keyof typeof orderByObject];
        }
    }

    if (Object.keys(parsed).length !== 1) {
        throw new Error("orderBy needs to be an object with exactly 1 property with either $asc or $desc value");
    }

    return parsed;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const parseQuery = (url?: string): ParsedQueryParameters => {
    if (url) {
        const { searchParams } = new URL(url);
        const parsedQuery: ParsedQueryParameters = {};

        if (searchParams.get("select")) {
            parsedQuery.select = parseRecursive(searchParams.get("select") as string);
        }

        if (searchParams.get("include")) {
            parsedQuery.include = parseRecursive(searchParams.get("include") as string);
        }

        if (searchParams.get("where")) {
            parsedQuery.where = parseWhere(searchParams.get("where") as string);
        }

        if (searchParams.get("orderBy")) {
            parsedQuery.orderBy = parseOrderBy(searchParams.get("orderBy") as string);
        }

        if (searchParams.has("limit")) {
            parsedQuery.limit = Number.isFinite(+(searchParams.get("limit") as string)) ? +(searchParams.get("limit") as string) : undefined;
        }

        if (searchParams.has("skip")) {
            parsedQuery.skip = Number.isFinite(+(searchParams.get("skip") as string)) ? +(searchParams.get("skip") as string) : undefined;
        }

        if (searchParams.get("distinct")) {
            parsedQuery.distinct = searchParams.get("distinct") as string;
        }

        if (searchParams.get("page")) {
            parsedQuery.page = Number.isFinite(+(searchParams.get("page") as string)) ? +(searchParams.get("page") as string) : undefined;
        }

        return {
            originalQuery: Object.fromEntries(searchParams.entries()),
            ...parsedQuery,
        };
    }

    return {};
};

export default parseQuery;
