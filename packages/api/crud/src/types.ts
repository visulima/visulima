import type { Handler as CreateHandler } from "./handler/create";
import type { Handler as DeleteHandler } from "./handler/delete";
import type { Handler as ListHandler } from "./handler/list";
import type { Handler as GetHandler } from "./handler/read";
import type { Handler as UpdateHandler } from "./handler/update";

export enum RouteType {
    CREATE = "CREATE",
    DELETE = "DELETE",
    READ_ALL = "READ_ALL",
    READ_ONE = "READ_ONE",
    UPDATE = "UPDATE",
}

export interface ModelOption {
    exclude?: RouteType[];
    formatResourceId?: (resourceId: string) => number | string;
    name?: string;
    only?: RouteType[];
}

export type ModelsOptions<M extends string = string> = {
    [key in M]?: ModelOption;
};

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
    models?: ModelsOptions<M>;
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
    create: (resourceName: M, data: any, query: Q) => Promise<T>;
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
    update: (resourceName: M, resourceId: number | string, data: any, query: Q) => Promise<T>;
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
    limit?: number | undefined;
    orderBy?: OrderByField;
    originalQuery?: Record<string, any>;
    page?: number | undefined;
    select?: RecursiveField;
    skip?: number | undefined;
    where?: WhereField;
}

export type ExecuteHandler<Request, Response> = (request: Request, response: Response) => Promise<void>;

export interface FakePrismaClient {
    $connect: () => void;
    $disconnect: () => Promise<void>;
    [key: string]: any;
    _dmmf?: any;

    _getDmmf?: () => any;
}
