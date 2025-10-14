import { RouteType } from "../types";
import type { SwaggerParameter } from "./types";

const queryParameters: Record<string, SwaggerParameter> = {
    distinct: {
        description: "Fields to distinctively retrieve",
        name: "distinct",
        schema: {
            type: "string",
        },
    },
    include: {
        description: "Include relations, same as select",
        name: "include",
        schema: {
            type: "string",
        },
    },
    limit: {
        description: "Maximum number of elements to retrieve",
        name: "limit",
        schema: {
            minimum: 0,
            type: "integer",
        },
    },
    orderBy: {
        description: "Field on which to order by a direction. See <a href=\"https://next-crud.js.org/query-params#orderBy\">the docs</a>",
        name: "orderBy",
        schema: {
            type: "string",
        },
    },
    page: {
        description: "Page number. Use only for pagination.",
        name: "page",
        schema: {
            minimum: 1,
            type: "integer",
        },
    },
    select: {
        description: "Fields to select. For nested fields, chain them separated with a dot, eg: user.posts",
        name: "select",
        schema: {
            type: "string",
        },
    },
    skip: {
        description: "Number of rows to skip",
        name: "skip",
        schema: {
            minimum: 0,
            type: "integer",
        },
    },
    where: {
        description: "Fields to filter. See <a href=\"https://next-crud.js.org/query-params#where\">the docs</a>",
        name: "where",
        schema: {
            type: "string",
        },
    },
};

export const commonQueryParameters = [queryParameters.select, queryParameters.include];
export const listQueryParameters = [
    ...commonQueryParameters,
    queryParameters.limit,
    queryParameters.skip,
    queryParameters.where,
    queryParameters.orderBy,
    queryParameters.page,
    queryParameters.distinct,
];

export const getQueryParameters = (routeType: RouteType, additionalQueryParameters: SwaggerParameter[] = []): SwaggerParameter[] => {
    if (routeType === RouteType.READ_ALL) {
        return [...listQueryParameters, ...additionalQueryParameters].filter(Boolean) as SwaggerParameter[];
    }

    return [...commonQueryParameters, ...additionalQueryParameters].filter(Boolean) as SwaggerParameter[];
};
