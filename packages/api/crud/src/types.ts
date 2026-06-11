export enum RouteType {
    CREATE = "CREATE",
    DELETE = "DELETE",
    READ_ALL = "READ_ALL",
    READ_ONE = "READ_ONE",
    UPDATE = "UPDATE",
}

/**
 * A minimal validation schema. It is intentionally structural so that any
 * validator exposing a synchronous/asynchronous `parse`/`safeParse` (e.g. zod)
 * can be plugged in without pulling a hard dependency on the validator.
 *
 * The returned (possibly transformed) value replaces `request.body` before it
 * reaches the adapter.
 */
export interface BodySchema<T = unknown> {
    parse: (data: unknown) => Promise<T> | T;
}

/**
 * Per-model access policy. Every field is optional and additive on top of the
 * route-level `only`/`exclude` knobs.
 */
export interface ModelAccessPolicy {
    /**
     * Validation/transform schema applied to the body of `CREATE` requests
     * before it is forwarded to the adapter. Throwing rejects the request
     * with the thrown error (use an `http-errors` 4xx for a clean status).
     */
    createSchema?: BodySchema;

    /**
     * Allowlist of field names a client may filter on (via `where`) or order by.
     * When set, any other field referenced in `where`/`orderBy` is rejected with
     * a 400. Prevents blind-exfiltration oracles on secret columns.
     */
    filterableFields?: string[];

    /**
     * Allowlist of relation names a client may `include`. When set, requesting
     * any other relation is rejected with a 400.
     */
    includableRelations?: string[];

    /**
     * Field names that must never be returned to a client. They are stripped
     * from `select` (if a client tried to select them) and forced into Prisma's
     * `omit`-style exclusion is left to the adapter; here we simply drop them
     * from an explicit `select`. Pair with `selectableFields` for a strict
     * allowlist.
     */
    readableFields?: string[];

    /**
     * Allowlist of field names a client may request via `select`. When set, any
     * other selected field is dropped. Prevents `?select=passwordHash`.
     */
    selectableFields?: string[];

    /**
     * Validation/transform schema applied to the body of `UPDATE` requests.
     */
    updateSchema?: BodySchema;

    /**
     * Allowlist of field names a client may write (CREATE/UPDATE body). When set,
     * any other key in the body is stripped before reaching the adapter,
     * preventing mass-assignment of columns like `role`/`isAdmin`.
     */
    writableFields?: string[];
}

export interface ModelOption extends ModelAccessPolicy {
    exclude?: RouteType[];
    formatResourceId?: (resourceId: string) => number | string;

    /**
     * Hard cap on the number of rows a list request may return, regardless of
     * the client-supplied `limit`. Overrides the handler-level `maxPerPage`.
     */
    maxPerPage?: number;
    name?: string;
    only?: RouteType[];
}

export type ModelsOptions<M extends string = string> = {
    [key in M]?: ModelOption;
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Request param flows into call sites in base-crud-handler
export type CreateHandler = <T, Q, Request>(
    parameters: HandlerParameters<T, Q> & { request: Request & { body: Record<string, unknown> } },
) => Promise<{
    data: unknown;
    status: number;
}>;

export type DeleteHandler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: unknown;
    status: number;
}>;

export type GetHandler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: unknown;
    status: number;
}>;

export type ListHandler = <T, Q extends ParsedQueryParameters>(
    parameters: HandlerParameters<T, Q> & { pagination: PaginationConfig },
) => Promise<{
    data: unknown;
    status: number;
}>;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Request param flows into call sites in base-crud-handler
export type UpdateHandler = <T, Q, Request>(
    parameters: UniqueResourceHandlerParameters<T, Q> & { request: Request & { body: Partial<T> } },
) => Promise<{
    data: unknown;
    status: number;
}>;

export interface HandlerOptions<M extends string = string> {
    exposeStrategy?: "all" | "none";
    formatResourceId?: (resourceId: string) => number | string;
    handlers?: {
        create?: CreateHandler;
        delete?: DeleteHandler;
        get?: GetHandler;
        list?: ListHandler;
        update?: UpdateHandler;
    };

    /**
     * Default hard cap on the number of rows a list request may return for any
     * model, regardless of the client-supplied `limit`. Defaults to no cap.
     * Per-model `maxPerPage` overrides this.
     */
    maxPerPage?: number;
    models?: ModelsOptions<M>;

    /**
     * Called once per request after the route type is resolved and before the
     * adapter is invoked. Throw (ideally an `http-errors` error) to reject the
     * request — a row/field access guard hook. Receives the resolved model name,
     * route type and resource id (for single-resource routes).
     */
    onRequest?: (context: { method: string; resourceId?: number | string; resourceName: string; routeType: RouteType; url: string }) => Promise<void> | void;
    pagination?: PaginationConfig;
}

export interface PaginationConfig {
    perPage: number;
}

export interface HandlerParameters<T, Q> {
    adapter: Adapter<T, Q>;
    query: Q;
    resourceName: string;
}

export interface UniqueResourceHandlerParameters<T, Q> {
    adapter: Adapter<T, Q>;
    query: Q;
    resourceId: number | string;
    resourceName: string;
}

export interface Adapter<T, Q, M extends string = string> {
    connect?: () => Promise<void>;
    create: (resourceName: M, data: unknown, query: Q) => Promise<T>;
    delete: (resourceName: M, resourceId: number | string, query: Q) => Promise<T>;
    disconnect?: () => Promise<void>;
    getAll: (resourceName: M, query: Q) => Promise<T[]>;
    getModels: () => M[];
    getOne: (resourceName: M, resourceId: number | string, query: Q) => Promise<T>;
    getPaginationData: (resourceName: M, query: Q) => Promise<PaginationData>;
    handleError?: (error: Error) => void;
    init?: () => Promise<void>;
    mapModelsToRouteNames?: () => Promise<{ [key in M]?: string }>;
    models?: M[];
    parseQuery: (resourceName: M, query: ParsedQueryParameters) => Q;
    update: (resourceName: M, resourceId: number | string, data: unknown, query: Q) => Promise<T>;
}

export interface PaginationData {
    page: number;
    pageCount: number;
    total: number;
}

export type RecursiveField = Record<string, Record<string, boolean> | boolean>;

export type WhereOperator = "$cont" | "$ends" | "$eq" | "$gt" | "$gte" | "$in" | "$isnull" | "$lt" | "$lte" | "$neq" | "$notin" | "$starts";

export type SearchCondition = Date | boolean | number | string | null;

export type WhereCondition = {
    [key in WhereOperator]?: SearchCondition;
};

export type Condition = { [key: string]: Condition | SearchCondition | WhereCondition };

export type WhereField = Condition & {
    $and?: Condition | Condition[];
    $not?: Condition | Condition[];
    $or?: Condition | Condition[];
};

export type OrderByOperator = "$asc" | "$desc";

export type OrderByField = Record<string, OrderByOperator>;

export interface ParsedQueryParameters {
    distinct?: string;
    include?: RecursiveField;
    limit?: number;
    orderBy?: OrderByField;
    originalQuery?: Record<string, string>;
    page?: number;
    select?: RecursiveField;
    skip?: number;
    where?: WhereField;
}

export type ExecuteHandler<Request, Response, Result = void> = (request: Request, response: Response) => Promise<Result>;

export interface FakePrismaClient {
    $connect: () => Promise<void> | void;
    $disconnect: () => Promise<void>;
    [key: string]: unknown;
    _dmmf?: unknown;

    _getDmmf?: () => unknown;
}
