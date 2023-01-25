import type { Handler as CreateHandler } from "./handler/create";
import type { Handler as DeleteHandler } from "./handler/delete";
import type { Handler as ListHandler } from "./handler/list";
import type { Handler as GetHandler } from "./handler/read";
import type { Handler as UpdateHandler } from "./handler/update";

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
    formatResourceId?: (resourceId: string) => number | string
};

export type ModelsOptions<M extends string = string> = {
    [key in M]?: ModelOption
};

export type HandlerOptions<M extends string = string> = {
    formatResourceId?: (resourceId: string) => number | string;
    models?: ModelsOptions<M>;
    exposeStrategy?: "all" | "none";
    pagination?: PaginationConfig,
    handlers?: {
        create?: CreateHandler;
        delete?: DeleteHandler;
        get?: GetHandler;
        list?: ListHandler;
        update?: UpdateHandler;
    },
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
    resourceId: number | string;
}

export interface Adapter<T, Q, M extends string = string> {
    models?: M[];
    init?: () => Promise<void>;
    parseQuery: (resourceName: M, query: ParsedQueryParameters) => Q;
    getAll: (resourceName: M, query: Q) => Promise<T[]>;
    getOne: (resourceName: M, resourceId: number | string, query: Q) => Promise<T>;
    create: (resourceName: M, data: any, query: Q) => Promise<T>;
    update: (resourceName: M, resourceId: number | string, data: any, query: Q) => Promise<T>;
    delete: (resourceName: M, resourceId: number | string, query: Q) => Promise<T>;
    getPaginationData: (resourceName: M, query: Q) => Promise<PaginationData>;
    getModels: () => M[];
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
    [key: string]: TRecursiveField | boolean;
};

export type WhereOperator = "$cont" | "$ends" | "$eq" | "$gt" | "$gte" | "$in" | "$isnull" | "$lt" | "$lte" | "$neq" | "$notin" | "$starts";

export type SearchCondition = Date | boolean | number | string | null;

export type WhereCondition = {
    [key in TWhereOperator]?: TSearchCondition;
};

export type Condition = {
    [key: string]: TCondition | TSearchCondition | TWhereCondition;
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

export type ExecuteHandler<Request, Response> = (request: Request, response: Response) => Promise<void>;
