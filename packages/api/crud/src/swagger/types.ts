import type { OpenAPIV3 } from "openapi-types";

import type { RouteType } from "../types";

export interface SwaggerType {
    description?: string;
    isArray?: boolean;
    name: string;
    required?: boolean;
}

export interface SwaggerOperation {
    body?: SwaggerType;
    response: SwaggerType;
    responses?: Record<number, OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject>;
    summary?: string;
}

export interface SwaggerParameter {
    description?: string;
    name: string;

    schema: OpenAPIV3.SchemaObject;
}

export interface ModelsConfig {
    additionalQueryParams?: SwaggerParameter[];
    routeTypes?: {
        [RouteType.CREATE]?: SwaggerOperation;
        [RouteType.DELETE]?: SwaggerOperation;
        [RouteType.READ_ALL]?: SwaggerOperation;
        [RouteType.READ_ONE]?: SwaggerOperation;
        [RouteType.UPDATE]?: SwaggerOperation;
    };
    tag: OpenAPIV3.TagObject;
    type?: SwaggerType;
}

export type SwaggerModelsConfig<M extends string> = {
    [key in M]?: ModelsConfig;
};

export type Routes<M extends string> = {
    [key in M]?: RouteType[];
};
