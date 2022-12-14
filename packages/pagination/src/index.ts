import Paginator from "./paginator";
import type { Paginator as PaginatorInterface } from "./types";

export type { Paginator as PaginatorInterface, PaginationResult, PaginationMeta } from "./types.d";
export { default as Paginator } from "./paginator";

// eslint-disable-next-line max-len
export const paginate = <Result>(page: number, perPage: number, total: number, rows: Result[]): PaginatorInterface<Result> => new Paginator(total, Number(perPage), Number(page), ...rows);

export { createPaginationSchemaObject, createPaginationMetaSchemaObject } from "./swagger";
