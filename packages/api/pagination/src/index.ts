import Paginator from "./paginator";
import type { Paginator as PaginatorInterface } from "./types";

export type { CursorPaginatorOptions } from "./cursor-paginator";
export { default as CursorPaginator } from "./cursor-paginator";
export type { WindowedUrl, WindowOptions } from "./paginator";
export { default as Paginator, snakeCaseNamingStrategy } from "./paginator";
export type { CreatePaginationMetaSchemaOptions, CreatePaginationSchemaOptions, OpenApiVersion } from "./swagger";
export { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "./swagger";

/**
 * Create a {@link PaginatorInterface} for the given page of rows.
 * @remarks
 * The `rows` you pass in are treated as the rows for the current page **as-is** —
 * they are NOT sliced. Pre-slice your rows at the data source using the offset
 * (`(page - 1) * perPage`) and `perPage` limit. `total` is the count of all
 * matching records and drives `lastPage`/URL computation.
 * @param page The current page (clamped to be at least 1).
 * @param perPage Rows per page (clamped to be at least 1).
 * @param total Total number of matching records.
 * @param rows The pre-sliced rows for the current page.
 */
export const paginate = <Result>(page: number, perPage: number, total: number, rows: Result[]): PaginatorInterface<Result> =>
    Paginator.fromArray<Result>(total, perPage, page, rows);

export type {
    CursorPaginationMeta,
    CursorPaginationResult,
    CursorPaginator as CursorPaginatorInterface,
    NamingStrategy,
    PaginationMeta,
    PaginationResult,
    Paginator as PaginatorInterface,
} from "./types.d";
