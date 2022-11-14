export enum RouteType {
    CREATE = "CREATE",
    READ_ALL = "READ_ALL",
    READ_ONE = "READ_ONE",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
}

export type ModelOption = {
    name?: string
    only?: RouteType[]
    exclude?: RouteType[]
    formatResourceId?: (resourceId: string) => string | number
};

export type ModelsOptions<M extends string = string> = {
    [key in M]?: ModelOption
};

export type HandlerOptions<M extends string = string> = {
    formatResourceId?: (resourceId: string) => string | number;
    models?: ModelsOptions<M>;
    exposeStrategy?: "all" | "none";
    pagination?: PaginationConfig
};

export type PaginationConfig = {
    perPage: number
};

export interface HandlerParameters<T, Q> {
    adapter: Adapter<T, Q>;
    query: Q;
    resourceName: string;
}

export interface UniqueResourceHandlerParameters<T, Q> {
    adapter: Adapter<T, Q>;
    query: Q;
    resourceName: string;
    resourceId: string | number;
}

export interface Adapter<T, Q, M extends string = string> {
    models?: M[];
    init?: () => Promise<void>;
    parseQuery(resourceName: M, query: ParsedQueryParameters): Q;
    getAll(resourceName: M, query: Q): Promise<T[]>;
    getOne(resourceName: M, resourceId: string | number, query: Q): Promise<T>;
    create(resourceName: M, data: any, query: Q): Promise<T>;
    update(resourceName: M, resourceId: string | number, data: any, query: Q): Promise<T>;
    delete(resourceName: M, resourceId: string | number, query: Q): Promise<T>;
    getPaginationData(resourceName: M, query: Q): Promise<PaginationData>;
    getModels(): M[];
    connect?: () => Promise<void>;
    disconnect?: () => Promise<void>;
    handleError?: (error: Error) => void;
    mapModelsToRouteNames?: () => Promise<{ [key in M]?: string }>;
}

export type PaginationData = {
    total: number
    pageCount: number
    page: number
};

export type RecursiveField = {
    [key: string]: boolean | TRecursiveField;
};

export type WhereOperator = "$eq" | "$neq" | "$in" | "$notin" | "$lt" | "$lte" | "$gt" | "$gte" | "$cont" | "$starts" | "$ends" | "$isnull";

export type SearchCondition = string | boolean | number | Date | null;

export type WhereCondition = {
    [key in TWhereOperator]?: TSearchCondition;
};

export type Condition = {
    [key: string]: TSearchCondition | TWhereCondition | TCondition;
};

export type WhereField = Condition & {
    $and?: TCondition | TCondition[];
    $or?: TCondition | TCondition[];
    $not?: TCondition | TCondition[];
};

export type OrderByOperator = "$asc" | "$desc";

export type OrderByField = {
    [key: string]: TOrderByOperator;
};

export interface ParsedQueryParameters {
    select?: RecursiveField;
    include?: RecursiveField;
    where?: WhereField;
    orderBy?: OrderByField;
    limit?: number;
    skip?: number;
    distinct?: string;
    page?: number;
    originalQuery?: {
        [key: string]: any;
    };
}

export interface ExecuteHandler<Request, Response> {
    (request: Request, response: Response): Promise<void>;
}

/**
 * Error codes for errors on server side
 */
export enum ServerErrorCode {
    /**
     * The specified entity cannot be found
     */
    ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND",

    /**
     * The request parameter is invalid, either containing invalid fields or missing required fields
     */
    INVALID_REQUEST_PARAMS = "INVALID_REQUEST_PARAMS",

    /**
     * The request is rejected by policy checks
     */
    DENIED_BY_POLICY = "DENIED_BY_POLICY",

    /**
     * Violation of database unique constraints
     */
    UNIQUE_CONSTRAINT_VIOLATION = "UNIQUE_CONSTRAINT_VIOLATION",

    /**
     * Violation of database reference constraint (aka. foreign key constraints)
     */
    REFERENCE_CONSTRAINT_VIOLATION = "REFERENCE_CONSTRAINT_VIOLATION",

    /**
     * A write operation succeeded but the result cannot be read back due to policy control
     */
    READ_BACK_AFTER_WRITE_DENIED = "READ_BACK_AFTER_WRITE_DENIED",

    /**
     * Unknown error
     */
    UNKNOWN = "UNKNOWN",
}
