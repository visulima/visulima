import { IncomingMessage, ServerResponse } from "node:http";
import type { SimplePaginator } from "../pagination";

export enum RouteType {
  CREATE = 'CREATE',
  READ_ALL = 'READ_ALL',
  READ_ONE = 'READ_ONE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export type ValueOrPromise<T> = T | Promise<T>;

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

export interface RequestHandler<Request extends IncomingMessage, Response extends ServerResponse> {
    (request: Request, response: Response): ValueOrPromise<void>;
}

export interface Handler<T, Q, Parameters, Request extends IncomingMessage, Response extends ServerResponse> {
    (parameters: Parameters<T, Q>): RequestHandler<Request, Response>;
}

export interface Adapter<T, Q, M extends string = string> {
    models: M[];
    init?: () => Promise<void>;
    parseQuery(resourceName: M, query?: ParsedQueryParams): Q;
    getAll(resourceName: M, query?: Q): Promise<T[]>;
    getOne(resourceName: M, resourceId: string | number, query?: Q): Promise<T>;
    create(resourceName: M, data: any, query?: Q): Promise<T>;
    update(resourceName: M, resourceId: string | number, data: any, query?: Q): Promise<T>;
    delete(resourceName: M, resourceId: string | number, query?: Q): Promise<T>;
    getPaginationData<D>(resourceName: M, query: Q): Promise<SimplePaginator<T[]>>;
    getModels(): M[];
    connect?: () => Promise<void>;
    disconnect?: () => Promise<void>;
    handleError?: (err: Error) => void;
    getModelsJsonSchema?: () => any;
    mapModelsToRouteNames?: () => { [key in M]?: string };
}

export type SearchCondition = string | boolean | number | Date | null;

export type WhereCondition = {
    [key in WhereOperator]?: SearchCondition;
};

export type Condition = {
    [key: string]: SearchCondition | WhereCondition | Condition;
};

export type WhereField = Condition & {
    $and?: Condition | Condition[];
    $or?: Condition | Condition[];
    $not?: Condition | Condition[];
};

export type OrderByOperator = "$asc" | "$desc";

export type OrderByField = {
    [key: string]: TOrderByOperator;
};

export interface ParsedQueryParams {
    select?: TRecursiveField;
    include?: TRecursiveField;
    where?: TWhereField;
    orderBy?: TOrderByField;
    limit?: number;
    skip?: number;
    distinct?: string;
    page?: number;
    originalQuery?: {
        [key: string]: any;
    };
}

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

export interface ParsedQueryParams {
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

export type PageBasedPagination = {
    page: number;
    perPage: number;
};

