import type { Condition, SearchCondition } from "../../types.d";

export type PrismaRecursiveField = "include" | "select";

export type PrismaRecursive<T extends PrismaRecursiveField> = Record<string, boolean | { [key in T]: PrismaRecursive<T> }>;

export type PrismaWhereOperator = "contains" | "endsWith" | "equals" | "gt" | "gte" | "in" | "lt" | "lte" | "not" | "notIn" | "startsWith";

export type PrismaOrderByOperator = "asc" | "desc";

export type PrismaFieldFilterOperator = {
    [key in PrismaWhereOperator]?: SearchCondition;
};

export type PrismaFieldFilter = {
    [key: string]: Condition | PrismaFieldFilterOperator | PrismaRelationFilter | SearchCondition | undefined;
};

export type PrismaWhereField = PrismaFieldFilter & {
    AND?: PrismaFieldFilter;
    OR?: PrismaFieldFilter;
    NOT?: PrismaFieldFilter;
};

export type PrismaRelationFilter = {
    some?: PrismaFieldFilter | SearchCondition;
};

export type PrismaOrderBy = {
    [key: string]: PrismaOrderByOperator;
};

export type PrismaCursor = {
    [key: string]: boolean | number | string;
};

export interface PrismaParsedQueryParameters {
    select?: PrismaRecursive<"select">;
    include?: PrismaRecursive<"include">;
    where?: PrismaWhereField;
    orderBy?: PrismaOrderBy;
    take?: number;
    skip?: number;
    cursor?: PrismaCursor;
    distinct?: string;
}
