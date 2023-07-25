import Paginator from "./paginator";
import type { Paginator as PaginatorInterface } from "./types";

export { default as Paginator } from "./paginator";
export { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "./swagger";

export const paginate = <Result>(page: number, perPage: number, total: number, rows: Result[]): PaginatorInterface<Result> =>
    new Paginator(total, Number(perPage), Number(page), ...rows);

export type { PaginationMeta, PaginationResult, Paginator as PaginatorInterface } from "./types.d";
