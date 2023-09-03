import type { GetRouteType } from "./utils/get-route-type";

export type CreateHandler = <T, Q, Request>(
    parameters: HandlerParameters<T, Q> & { request: Request & { body: Record<string, any> } },
) => Promise<{
    data: any;
    status: number;
}>;

export type DeleteHandler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: any;
    status: number;
}>;

export type ListHandler = <T, Q extends ParsedQueryParameters>(
    parameters: HandlerParameters<T, Q> & { pagination: PaginationConfig },
) => Promise<{
    data: any;
    status: number;
}>;

export type GetHandler = <T, Q>(
    parameters: UniqueResourceHandlerParameters<T, Q>,
) => Promise<{
    data: any;
    status: number;
}>;

export type UpdateHandler = <T, Q, Request>(
    parameters: UniqueResourceHandlerParameters<T, Q> & { request: Request & { body: Partial<T> } },
) => Promise<{
    data: any;
    status: number;
}>;

// eslint-disable-next-line no-shadow
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

export type MarshalFunction<Data = any, ReturnValue = any> = (data: Data) => ReturnValue;
export type UnmarshalFunction<Data = any, ReturnValue = any> = (data: Data) => ReturnValue;

export interface HandlerOptions<M extends string, Request, Response> {
    callbacks?: {
        onError?: <T>(request: Request, response: Response, error: Error & T) => Promise<void> | void;
        onRequest?: (request: Request, response: Response, options?: GetRouteType & { resourceName: string }) => Promise<void> | void;
        onSuccess?: (payload: { data: any; status: number }) => Promise<void> | void;
    };
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
    serialization?: {
        marshal: MarshalFunction;
        unmarshal: UnmarshalFunction;
    };
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
    parseQuery: (
        resourceName: M,
        query: ParsedQueryParameters,
        serialization: {
            marshal: MarshalFunction;
            unmarshal: UnmarshalFunction;
        },
    ) => Q;
    update: (resourceName: M, resourceId: number | string, data: any, query: Q) => Promise<T>;
}

export interface PaginationData {
    page: number;
    pageCount: number;
    total: number;
}

export interface RecursiveField {
    [key: string]: RecursiveField | boolean;
}

export type WhereOperator = "$cont" | "$ends" | "$eq" | "$gt" | "$gte" | "$in" | "$isnull" | "$lt" | "$lte" | "$neq" | "$notin" | "$starts";

export type SearchCondition = Date | boolean | number | string | null;

export type WhereCondition = {
    [key in WhereOperator]?: SearchCondition;
};

export interface Condition {
    [key: string]: Condition | SearchCondition | WhereCondition;
}

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
    originalQuery?: Record<string, any>;
    page?: number;
    select?: RecursiveField;
    skip?: number;
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
