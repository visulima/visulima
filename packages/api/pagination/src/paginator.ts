import type { NamingStrategy, PaginationMeta, PaginationResult, Paginator as IPaginator, WindowedUrl, WindowOptions } from "./types";

type UrlsForRange = { isActive: boolean; page: number; url: string }[];

/**
 * Identity naming strategy. Returns meta keys unchanged (camelCase).
 */
const camelCaseNamingStrategy: NamingStrategy = (key) => key;

/**
 * Maps the camelCase meta keys to their `snake_case` equivalents
 * (Laravel / AdonisJS style).
 */
const snakeCaseKeyMap: Record<string, string> = {
    firstPage: "first_page",
    firstPageUrl: "first_page_url",
    lastPage: "last_page",
    lastPageUrl: "last_page_url",
    nextPageUrl: "next_page_url",
    page: "page",
    perPage: "per_page",
    previousPageUrl: "previous_page_url",
    total: "total",
};

/**
 * Built-in `snake_case` naming strategy. Use it to emit Laravel/AdonisJS-style
 * meta keys (`per_page`, `last_page`, …).
 */
const snakeCaseNamingStrategy: NamingStrategy = (key) => snakeCaseKeyMap[key] ?? key;

/**
 * Simple paginator works with the data set provided by the standard
 * `offset` and `limit` based pagination.
 *
 * `Paginator` is an `Array` subclass that holds **only the rows for the current
 * page**. It does NOT slice the rows you pass in — you are expected to pre-slice
 * the page rows (via your data store's `offset`/`limit`) before constructing it.
 * `total` is the count of *all* matching records, used to compute `lastPage` and
 * the pagination URLs.
 */
class Paginator<T = unknown> extends Array<T> implements IPaginator<T> {
    /**
     * Ensure inherited Array methods (map/filter/slice/...) return plain Arrays
     * instead of partially-constructed Paginator instances.
     */
    public static override get [Symbol.species](): ArrayConstructor {
        return Array;
    }

    /**
     * Construct a `Paginator` from an array of rows without spreading them as
     * call arguments. Safe for arbitrarily large row sets (no
     * `Maximum call stack size exceeded`). Prefer this over the variadic
     * constructor when the row count may be large.
     * @param totalNumber Total number of matching records.
     * @param perPage Rows per page (clamped to be at least 1).
     * @param currentPage The current page number (clamped to be at least 1).
     * @param rows The pre-sliced rows for the current page.
     */
    public static fromArray<Result = unknown>(totalNumber: number, perPage: number, currentPage: number, rows: Result[]): Paginator<Result> {
        const paginator = new Paginator<Result>(totalNumber, perPage, currentPage);
        const { length } = rows;

        paginator.length = length;

        // eslint-disable-next-line no-plusplus
        for (let index = 0; index < length; index++) {
            paginator[index] = rows[index] as Result;
        }

        // `isEmpty` is set in the (empty) constructor call above; refresh it.
        (paginator as { isEmpty: boolean }).isEmpty = length === 0;

        return paginator;
    }

    /**
     * The first page is always 1
     */
    public readonly firstPage: number = 1;

    /**
     * Find if results set is empty or not
     */
    public readonly isEmpty: boolean;

    /**
     * Current page number. Always clamped to be at least 1.
     */
    public currentPage: number;

    private readonly totalNumber: number;

    private readonly perPageNumber: number;

    private qs: Record<string, unknown> = {};

    private url = "/";

    /**
     * Pre-serialized query string (without the trailing `page` parameter),
     * recomputed only when `queryString()` changes. Avoids re-iterating and
     * re-serializing `this.qs` on every `getUrl()` call in the `getMeta()` hot path.
     */
    private baseQuery = "";

    /**
     * For large row sets prefer `Paginator.fromArray`: spreading rows as call
     * arguments (`new Paginator(t, p, c, ...rows)`) throws
     * `RangeError: Maximum call stack size exceeded` around ~100k rows on V8.
     * @param totalNumber Total number of matching records (used for `lastPage`/URL math).
     * @param perPage Rows per page (clamped to be at least 1).
     * @param currentPage The current page number (clamped to be at least 1).
     * @param rows The pre-sliced rows for the current page. They are NOT sliced by the paginator.
     */
    public constructor(totalNumber: number, perPage: number, currentPage: number, ...rows: T[]) {
        super();

        // Avoid `this.push(...rows)`: spreading rows as call arguments throws
        // `RangeError: Maximum call stack size exceeded` for large datasets
        // (~100k rows on V8). Index-write instead — backed by a single store.
        const { length } = rows;

        this.length = length;

        // eslint-disable-next-line no-plusplus
        for (let index = 0; index < length; index++) {
            this[index] = rows[index] as T;
        }

        // Clamp the perPage/total to sane values so derived meta (lastPage, URLs)
        // never produces NaN/negative output for invalid input.
        this.totalNumber = Number.isFinite(totalNumber) ? Math.max(Math.trunc(totalNumber), 0) : 0;
        this.perPageNumber = Number.isFinite(perPage) && perPage > 0 ? Math.trunc(perPage) : 1;
        this.currentPage = Number.isFinite(currentPage) ? Math.max(Math.trunc(currentPage), 1) : 1;

        this.isEmpty = length === 0;
    }

    /**
     * The number of rows shown per page.
     */
    public get perPage(): number {
        return this.perPageNumber;
    }

    /**
     * A reference to the result rows for the current page.
     *
     * Returns a shallow copy so callers cannot mutate the paginator's backing
     * store, and so the returned value is a plain `Array` (not a `Paginator`).
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
     * Returns JSON meta data. Pass `snakeCaseNamingStrategy` for
     * Laravel/AdonisJS-style output.
     * @param namingStrategy Optional key-transform applied to every meta key.
     */
    public getMeta(namingStrategy: NamingStrategy = camelCaseNamingStrategy): PaginationMeta {
        const meta: Record<string, unknown> = {
            firstPage: this.firstPage,
            firstPageUrl: this.getUrl(1),
            lastPage: this.lastPage,
            lastPageUrl: this.getUrl(this.lastPage),
            nextPageUrl: this.getNextPageUrl(),
            page: this.currentPage,
            perPage: this.perPage,
            previousPageUrl: this.getPreviousPageUrl(),
            total: this.total,
        };

        if (namingStrategy === camelCaseNamingStrategy) {
            return meta as unknown as PaginationMeta;
        }

        const transformed: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(meta)) {
            transformed[namingStrategy(key)] = value;
        }

        return transformed as unknown as PaginationMeta;
    }

    /**
     * Returns url for the next page.
     */
    public getNextPageUrl(): string | null {
        if (this.hasMorePages) {
            return this.getUrl(this.currentPage + 1);
        }

        // eslint-disable-next-line unicorn/no-null
        return null;
    }

    /**
     * Returns URL for the previous page.
     */
    public getPreviousPageUrl(): string | null {
        if (this.currentPage > 1) {
            return this.getUrl(this.currentPage - 1);
        }

        // eslint-disable-next-line unicorn/no-null
        return null;
    }

    /**
     * Returns url for a given page. Doesn't validate the integrity of the
     * page (only clamps the page number to be at least 1).
     */
    public getUrl(page: number): string {
        const pageParameter = `page=${encodeURIComponent(String(Math.max(page, 1)))}`;

        return this.baseQuery === "" ? `${this.url}?${pageParameter}` : `${this.url}?${this.baseQuery}&${pageParameter}`;
    }

    /**
     * Returns an array of urls under a given inclusive range.
     */
    public getUrlsForRange(start: number, end: number): UrlsForRange {
        const urls: UrlsForRange = [];

        // eslint-disable-next-line no-plusplus
        for (let index = start; index <= end; index++) {
            urls.push({ isActive: index === this.currentPage, page: index, url: this.getUrl(index) });
        }

        return urls;
    }

    /**
     * Returns a windowed list of page urls centered on the current page, with
     * `null`-page ellipsis markers for the gaps (e.g. `1 … 4 [5] 6 … 20`).
     *
     * Use the `page === null` entries to render an ellipsis ("…") in your UI.
     */
    public getUrlsForWindow(options: WindowOptions = {}): WindowedUrl[] {
        const requestedEachSide = options.eachSide;
        const eachSide =
            typeof requestedEachSide === "number" && Number.isFinite(requestedEachSide) && requestedEachSide >= 0 ? Math.trunc(requestedEachSide) : 2;
        const { lastPage } = this;

        // Small enough to show every page without ellipsis.
        if (lastPage <= eachSide * 2 + 3) {
            return this.getUrlsForRange(1, lastPage).map((entry) => {
                return { ...entry };
            });
        }

        const windowStart = Math.max(this.currentPage - eachSide, 1);
        const windowEnd = Math.min(this.currentPage + eachSide, lastPage);
        const result: WindowedUrl[] = [];

        // eslint-disable-next-line unicorn/no-null
        const ellipsis: WindowedUrl = { isActive: false, page: null, url: null };

        // Leading page + ellipsis.
        if (windowStart > 1) {
            result.push({ isActive: this.currentPage === 1, page: 1, url: this.getUrl(1) });

            if (windowStart > 2) {
                result.push({ ...ellipsis });
            }
        }

        for (const entry of this.getUrlsForRange(windowStart, windowEnd)) {
            result.push(entry);
        }

        // Trailing ellipsis + last page.
        if (windowEnd < lastPage) {
            if (windowEnd < lastPage - 1) {
                result.push({ ...ellipsis });
            }

            result.push({ isActive: this.currentPage === lastPage, page: lastPage, url: this.getUrl(lastPage) });
        }

        return result;
    }

    /**
     * Define query string to be appended to the pagination links.
     */
    public queryString(values: Record<string, unknown>): this {
        this.qs = values;

        const searchParameters = new URLSearchParams();

        for (const [key, value] of Object.entries(this.qs)) {
            if (value !== undefined && value !== null) {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                searchParameters.append(key, String(value));
            }
        }

        this.baseQuery = searchParameters.toString();

        return this;
    }

    /**
     * Returns JSON representation of the paginated data.
     * @param namingStrategy Optional key-transform applied to the `meta` keys.
     */
    public toJSON(namingStrategy?: NamingStrategy): PaginationResult<T> {
        return {
            data: this.all(),
            meta: this.getMeta(namingStrategy),
        };
    }

    /**
     * Find if there are more pages to come.
     */
    public get hasMorePages(): boolean {
        return this.lastPage > this.currentPage;
    }

    /**
     * Find if there are enough results to be paginated or not.
     */
    public get hasPages(): boolean {
        return this.lastPage !== 1;
    }

    /**
     * Find if there are total records or not. This is not same as
     * `isEmpty`.
     *
     * The `isEmpty` reports about the current set of results. However, `hasTotal`
     * reports about the total number of records, regardless of the current.
     */
    public get hasTotal(): boolean {
        return this.total > 0;
    }

    /**
     * The Last page number.
     */
    public get lastPage(): number {
        return Math.max(Math.ceil(this.total / this.perPageNumber), 1);
    }

    /**
     * Casting `total` to a number. Later, we can think of situations
     * to cast it to a bigint.
     */
    public get total(): number {
        return this.totalNumber;
    }
}

export default Paginator;
export { snakeCaseNamingStrategy };
export type { WindowedUrl, WindowOptions } from "./types";
