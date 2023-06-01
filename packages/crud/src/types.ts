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

export enum RouteType {
    CREATE = "CREATE",
    READ_ALL = "READ_ALL",
    READ_ONE = "READ_ONE",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
}

export type ModelOption = {
    name?: string;
    only?: RouteType[];
    exclude?: RouteType[];
    formatResourceId?: (resourceId: string) => number | string;
};

export type ModelsOptions<M extends string = string> = {
    [key in M]?: ModelOption;
};

export type MarshalFunction<Data = any, ReturnValue = any> = (data: Data) => ReturnValue;
export type UnmarshalFunction<Data = any, ReturnValue = any> = (data: Data) => ReturnValue;

export type HandlerOptions<M extends string, Request, Response> = {
    formatResourceId?: (resourceId: string) => number | string;
    models?: ModelsOptions<M>;
    exposeStrategy?: "all" | "none";
    pagination?: PaginationConfig;
    handlers?: {
        create?: CreateHandler;
        delete?: DeleteHandler;
        get?: GetHandler;
        list?: ListHandler;
        update?: UpdateHandler;
    };
    serialization?: {
        marshal: MarshalFunction;
        unmarshal: UnmarshalFunction;
    };
    callbacks?: {
        onError?: <T>(request: Request, response: Response, error: Error & T) => Promise<void> | void;
        onRequest?: (request: Request, response: Response, options?: GetRouteType & { resourceName: string }) => Promise<void> | void;
        onSuccess?: (payload: { status: number; data: any }) => Promise<void> | void;
    };
};

export type PaginationConfig = {
    perPage: number;
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
    parseQuery: (
        resourceName: M,
        query: ParsedQueryParameters,
        serialization: {
            marshal: MarshalFunction;
            unmarshal: UnmarshalFunction;
        },
    ) => Q;
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
    total: number;
    pageCount: number;
    page: number;
};

export type RecursiveField = {
    [key: string]: RecursiveField | boolean;
};

export type WhereOperator = "$cont" | "$ends" | "$eq" | "$gt" | "$gte" | "$in" | "$isnull" | "$lt" | "$lte" | "$neq" | "$notin" | "$starts";

export type SearchCondition = Date | boolean | number | string | null;

export type WhereCondition = {
    [key in WhereOperator]?: SearchCondition;
};

export type Condition = {
    [key: string]: Condition | SearchCondition | WhereCondition;
};

export type WhereField = Condition & {
    $and?: Condition | Condition[];
    $or?: Condition | Condition[];
    $not?: Condition | Condition[];
};

export type OrderByOperator = "$asc" | "$desc";

export type OrderByField = {
    [key: string]: OrderByOperator;
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

export type FakePrismaClient = {
    _dmmf?: any;
    _getDmmf?: () => any;
    $connect: () => void;
    $disconnect: () => Promise<void>;

    [key: string]: any;
};
