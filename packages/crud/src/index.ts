export { default as PrismaAdapter } from "./adapter/prisma";

export { default as modelsToOpenApi } from "./swagger/adapter/prisma";
export type { ModelsToOpenApiParameters } from "./swagger/adapter/prisma";

export type { SwaggerModelsConfig } from "./swagger/types.d";

export type {
    Adapter,
    Condition,
    HandlerOptions as CrudHandlerOptions,
    HandlerParameters,
    ModelOption,
    ModelsOptions,
    OrderByField,
    OrderByOperator,
    PaginationConfig,
    PaginationData,
    ParsedQueryParameters,
    RecursiveField,
    SearchCondition,
    UniqueResourceHandlerParameters,
    WhereCondition,
    WhereField,
    WhereOperator,
} from "./types.d";
export { RouteType } from "./types.d";
