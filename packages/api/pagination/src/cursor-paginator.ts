import { buildUrl, serializeQuery } from "./build-query";
import type { CursorPaginationMeta, CursorPaginationResult, CursorPaginator as ICursorPaginator, CursorPaginatorOptions } from "./types";

const defaultGetCursor = (row: unknown): string => {
    if (row !== null && typeof row === "object" && "id" in row) {
        return String(row.id);
    }

    return String(row);
};

/**
 * Cursor-based paginator for stable infinite-scroll / keyset pagination over
 * large tables. Unlike the offset-based `Paginator`, it exposes opaque
 * `nextCursor` / `previousCursor` values instead of page numbers.
 *
 * Like `Paginator`, the rows you pass are the pre-fetched rows for the current
 * page — they are not sliced. `nextCursor` is derived from the last row via
 * `getCursor`.
 */
class CursorPaginator<T = unknown> extends Array<T> implements ICursorPaginator<T> {
    public static override get [Symbol.species](): ArrayConstructor {
        return Array;
    }

    /**
     * Construct a `CursorPaginator` from an array of rows without spreading them
     * as call arguments (safe for large row sets).
     * @param perPage Rows requested per page (clamped to be at least 1).
     * @param rows The pre-fetched rows for the current page.
     * @param options Current cursor, `hasMore` flag and `getCursor` resolver.
     */
    public static fromArray<Result = unknown>(perPage: number, rows: Result[], options: CursorPaginatorOptions<Result> = {}): CursorPaginator<Result> {
        return new CursorPaginator<Result>(perPage, options, rows);
    }

    public readonly isEmpty: boolean;

    public readonly perPage: number;

    private url = "/";

    private qs: Record<string, unknown> = {};

    private baseQuery = "";

    private readonly currentCursor: string | null;

    private readonly getCursor: (row: T) => string;

    private readonly hasMore: boolean;

    /**
     * @param perPage Rows requested per page (clamped to be at least 1).
     * @param options Current cursor, `hasMore` flag and `getCursor` resolver.
     * @param rows The pre-fetched rows for the current page. They are NOT sliced. Defaults to an empty array.
     */
    public constructor(perPage: number, options: CursorPaginatorOptions<T> = {}, rows: T[] = []) {
        super();

        // Avoid spreading `rows` (`super(...rows)` / `this.push(...rows)`): both
        // throw `RangeError: Maximum call stack size exceeded` for large datasets
        // (~100k rows on V8). Index-write instead — backed by a single store.
        const { length } = rows;

        this.length = length;

        // eslint-disable-next-line no-plusplus
        for (let index = 0; index < length; index++) {
            this[index] = rows[index] as T;
        }

        this.perPage = Number.isFinite(perPage) && perPage > 0 ? Math.trunc(perPage) : 1;
        // eslint-disable-next-line unicorn/no-null
        this.currentCursor = options.currentCursor ?? null;
        this.getCursor = options.getCursor ?? defaultGetCursor;
        this.hasMore = options.hasMore ?? false;
        this.isEmpty = length === 0;
    }

    /**
     * A shallow copy of the result rows for the current page (plain `Array`).
     */
    public all(): T[] {
        return [...this];
    }

    /**
     * Define base url for making the pagination links.
     */
    public baseUrl(url: string): this {
        this.url = url;

        return this;
    }

    /**
     * Define query string to be appended to the pagination links.
     */
    public queryString(values: Record<string, unknown>): this {
        this.qs = values;

        this.baseQuery = serializeQuery(this.qs);

        return this;
    }

    /**
     * The cursor pointing at the next page, or `null` when there is no next page.
     */
    public getNextCursor(): string | null {
        if (!this.hasMorePages || this.length === 0) {
            // eslint-disable-next-line unicorn/no-null
            return null;
        }

        return this.getCursor(this[this.length - 1] as T);
    }

    /**
     * The cursor pointing at the previous page (the cursor of the first row of
     * the current page), or `null` when there is no previous page.
     */
    public getPreviousCursor(): string | null {
        if (this.currentCursor === null || this.length === 0) {
            // eslint-disable-next-line unicorn/no-null
            return null;
        }

        return this.getCursor(this[0] as T);
    }

    /**
     * Returns the url for a given cursor, or `null` when the cursor is `null`.
     */
    public getUrl(cursor: string | null): string | null {
        if (cursor === null) {
            // eslint-disable-next-line unicorn/no-null
            return null;
        }

        const cursorParameter = `cursor=${encodeURIComponent(cursor)}`;

        return buildUrl(this.url, this.baseQuery, cursorParameter);
    }

    /**
     * Returns JSON meta data for the cursor page.
     */
    public getMeta(): CursorPaginationMeta {
        const nextCursor = this.getNextCursor();
        const previousCursor = this.getPreviousCursor();

        return {
            nextCursor,
            nextPageUrl: this.getUrl(nextCursor),
            perPage: this.perPage,
            previousCursor,
            previousPageUrl: this.getUrl(previousCursor),
        };
    }

    /**
     * Returns JSON representation of the paginated data.
     */
    public toJSON(): CursorPaginationResult<T> {
        return {
            data: this.all(),
            meta: this.getMeta(),
        };
    }

    /**
     * Whether there are more pages to come.
     */
    public get hasMorePages(): boolean {
        return this.hasMore;
    }
}

export default CursorPaginator;
export type { CursorPaginatorOptions } from "./types";
