import { parse } from "node:url";
// eslint-disable-next-line no-restricted-imports
import set from "lodash.set";

import type { OrderByField, ParsedQueryParameters, RecursiveField, WhereField } from "./types.d";

const parseRecursive = (select: string): RecursiveField => {
    const selectFields: RecursiveField = {};

    const fields = select.split(",");

    fields.forEach((field) => {
        set(selectFields, field, true);
    });

    return selectFields;
};

const parseWhere = (where: string): WhereField => {
    const whereObject = JSON.parse(where);
    const parsed: WhereField = {};

    Object.keys(whereObject).forEach((key) => {
        set(parsed, key, whereObject[key]);
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
const parseQuery = (queryString?: string): ParsedQueryParameters => {
    if (queryString) {
        const { query } = parse(queryString, true);
        const parsedQuery: ParsedQueryParameters = {};

        if (query["select"]) {
            parsedQuery.select = parseRecursive(query["select"] as string);
        }

        if (query["include"]) {
            parsedQuery.include = parseRecursive(query["include"] as string);
        }

        if (query["where"]) {
            parsedQuery.where = parseWhere(query["where"] as string);
        }

        if (query["orderBy"]) {
            parsedQuery.orderBy = parseOrderBy(query["orderBy"] as string);
        }

        if (query["limit"] !== undefined) {
            parsedQuery.limit = Number.isFinite(+query["limit"]) ? +query["limit"] : undefined;
        }
        if (query["skip"] !== undefined) {
            parsedQuery.skip = Number.isFinite(+query["skip"]) ? +query["skip"] : undefined;
        }

        if (query["distinct"]) {
            parsedQuery.distinct = query["distinct"] as string;
        }

        if (query["page"]) {
            parsedQuery.page = Number.isFinite(+query["page"]) ? +query["page"] : undefined;
        }

        return {
            originalQuery: query,
            ...parsedQuery,
        };
    }

    return {};
};

export default parseQuery;
