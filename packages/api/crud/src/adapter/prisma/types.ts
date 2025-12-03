import type { Condition, SearchCondition } from "../../types";

export type PrismaRecursiveField = "include" | "select";

export type PrismaRecursive<T extends PrismaRecursiveField> = Record<string, boolean | { [key in T]: PrismaRecursive<T> }>;

export type PrismaWhereOperator = "contains" | "endsWith" | "equals" | "gt" | "gte" | "in" | "lt" | "lte" | "not" | "notIn" | "startsWith";

export type PrismaOrderByOperator = "asc" | "desc";

export type PrismaFieldFilterOperator = {
    [key in PrismaWhereOperator]?: SearchCondition;
};

export type PrismaFieldFilter = Record<string, Condition | PrismaFieldFilterOperator | PrismaRelationFilter | SearchCondition | undefined>;

export type PrismaWhereField = PrismaFieldFilter & {
    AND?: PrismaFieldFilter;
    NOT?: PrismaFieldFilter;
    OR?: PrismaFieldFilter;
};

export interface PrismaRelationFilter {
    some?: PrismaFieldFilter | SearchCondition;
}

export type PrismaOrderBy = Record<string, PrismaOrderByOperator>;

export type PrismaCursor = Record<string, boolean | number | string>;

export interface PrismaParsedQueryParameters {
    cursor?: PrismaCursor;
    distinct?: string;
    include?: PrismaRecursive<"include">;
    orderBy?: PrismaOrderBy;
    select?: PrismaRecursive<"select">;
    skip?: number;
    take?: number;
    where?: PrismaWhereField;
}
