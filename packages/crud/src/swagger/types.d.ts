import type { OpenAPIV3 } from "openapi-types";

import type { RouteType } from "../types.d";

export type SwaggerType = {
    name: string;
    isArray?: boolean;
    description?: string;
    required?: boolean;
};

export type SwaggerOperation = {
    summary?: string;
    responses?: Record<number, any>;
    body?: SwaggerType;
    response: SwaggerType;
};

export type SwaggerParameter = {
    name: string;
    description?: string;
    schema: any & {
        type: string;
    };
};

export type ModelsConfig = {
    tag: OpenAPIV3.TagObject;
    type?: SwaggerType;
    routeTypes?: {
        [RouteType.READ_ALL]?: SwaggerOperation;
        [RouteType.READ_ONE]?: SwaggerOperation;
        [RouteType.CREATE]?: SwaggerOperation;
        [RouteType.UPDATE]?: SwaggerOperation;
        [RouteType.DELETE]?: SwaggerOperation;
    };
    additionalQueryParams?: SwaggerParameter[];
};

export type SwaggerModelsConfig<M extends string> = {
    [key in M]?: ModelsConfig;
};

export type Routes<M extends string> = {
    [key in M]?: RouteType[];
};
