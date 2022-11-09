import type { Condition, SearchCondition } from "../../types.d";

export type PrismaRecursiveField = "select" | "include";

export type PrismaRecursive<T extends PrismaRecursiveField> = Record<string, boolean | { [key in T]: PrismaRecursive<T> }>;

export type PrismaWhereOperator = "equals" | "not" | "in" | "notIn" | "lt" | "lte" | "gt" | "gte" | "contains" | "startsWith" | "endsWith";

export type PrismaOrderByOperator = "asc" | "desc";

export type PrismaFieldFilterOperator = {
    [key in PrismaWhereOperator]?: SearchCondition;
};

export type PrismaFieldFilter = {
    [key: string]: SearchCondition | PrismaFieldFilterOperator | PrismaRelationFilter | Condition | undefined;
};

export type PrismaWhereField = PrismaFieldFilter & {
    AND?: PrismaFieldFilter;
    OR?: PrismaFieldFilter;
    NOT?: PrismaFieldFilter;
};

export type PrismaRelationFilter = {
    some: SearchCondition | PrismaFieldFilter;
};

export type PrismaOrderBy = {
    [key: string]: PrismaOrderByOperator;
};

export type PrismaCursor = {
    [key: string]: string | number | boolean;
};

export interface PrismaParsedQueryParams {
    select?: PrismaRecursive<"select">;
    include?: PrismaRecursive<"include">;
    where?: PrismaWhereField;
    orderBy?: PrismaOrderBy;
    take?: number;
    skip?: number;
    cursor?: PrismaCursor;
    distinct?: string;
}
