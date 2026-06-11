export interface PaginationMeta {
    firstPage: number;

    /**
     * The URL for the first page. Always a string — `getUrl()` never returns null.
     */
    firstPageUrl: string;
    lastPage: number;

    /**
     * The URL for the last page. Always a string — `getUrl()` never returns null.
     */
    lastPageUrl: string;
    nextPageUrl: string | null;
    page: number;
    perPage: number;
    previousPageUrl: string | null;
    total: number;
}

export interface PaginationResult<Result> {
    data: Result[];
    meta: PaginationMeta;
}

/**
 * A key-transform applied to {@link PaginationMeta} keys. Return the desired
 * output key for a given camelCase meta key (e.g. `perPage` -> `per_page`).
 */
export type NamingStrategy = (key: string) => string;

/**
 * A windowed page-range entry. A `null` `page`/`url` represents an ellipsis ("…")
 * gap that a UI should render between page links.
 */
export interface WindowedUrl {
    isActive: boolean;
    page: number | null;
    url: string | null;
}

export interface WindowOptions {
    eachSide?: number;
}

export interface CursorPaginatorOptions<T> {
    /**
     * The cursor that was used to fetch the current page (e.g. the `cursor`
     * query parameter), if any. Used to derive `previousCursor`.
     */
    currentCursor?: string | null;

    /**
     * Derives the opaque cursor string for a row. Defaults to `String(row.id)`
     * when the row has an `id`, otherwise `String(row)`.
     */
    getCursor?: (row: T) => string;

    /**
     * Whether a next page exists. Defaults to `false`.
     */
    hasMore?: boolean;
}

export interface CursorPaginationMeta {
    nextCursor: string | null;
    nextPageUrl: string | null;
    perPage: number;
    previousCursor: string | null;
    previousPageUrl: string | null;
}

export interface CursorPaginationResult<Result> {
    data: Result[];
    meta: CursorPaginationMeta;
}

export interface CursorPaginator<Result> extends Array<Result> {
    all: () => Result[];
    baseUrl: (url: string) => this;
    getMeta: () => CursorPaginationMeta;
    getNextCursor: () => string | null;
    getPreviousCursor: () => string | null;
    getUrl: (cursor: string | null) => string | null;
    readonly hasMorePages: boolean;
    readonly isEmpty: boolean;
    readonly perPage: number;
    queryString: (values: Record<string, unknown>) => this;
    toJSON: () => CursorPaginationResult<Result>;
}

export interface Paginator<Result> extends Array<Result> {
    all: () => Result[];

    baseUrl: (url: string) => this;
    currentPage: number;
    readonly firstPage: number;
    getMeta: (namingStrategy?: NamingStrategy) => PaginationMeta;
    getNextPageUrl: () => string | null;
    getPreviousPageUrl: () => string | null;
    getUrl: (page: number) => string;
    getUrlsForRange: (start: number, end: number) => { isActive: boolean; page: number; url: string }[];
    getUrlsForWindow: (options?: WindowOptions) => WindowedUrl[];
    readonly hasMorePages: boolean;

    readonly hasPages: boolean;
    readonly hasTotal: boolean;
    readonly isEmpty: boolean;
    readonly lastPage: number;
    readonly perPage: number;
    queryString: (values: Record<string, unknown>) => this;
    toJSON: (namingStrategy?: NamingStrategy) => PaginationResult<Result>;
    readonly total: number;
}
