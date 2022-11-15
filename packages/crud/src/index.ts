export { default as PrismaAdapter } from "./adapter/prisma";

export { RouteType } from "./types.d";
export type {
    ParsedQueryParameters,
    PaginationConfig,
    HandlerParameters,
    Adapter,
    ModelsOptions,
    HandlerOptions as CrudHandlerOptions,
    ModelOption,
    UniqueResourceHandlerParameters,
    Condition,
    OrderByField,
    OrderByOperator,
    RecursiveField,
    WhereField,
    WhereOperator,
    WhereCondition,
    SearchCondition,
    PaginationData,
} from "./types.d";

export type { SwaggerModelsConfig } from "./swagger/types.d";

export type { ModelsToOpenApiParameters } from "./swagger/adapter/prisma";
export { default as modelsToOpenApi } from "./swagger/adapter/prisma";
