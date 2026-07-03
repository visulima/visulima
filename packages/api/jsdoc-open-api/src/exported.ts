export interface BaseDefinition {
    components?: ComponentsObject;
    externalDocs?: ExternalDocumentationObject;
    info: InfoObject;
    openapi: string;
    paths?: PathsObject;
    security?: SecurityRequirementObject[];
    servers?: ServerObject[];
    tags?: TagObject[];
}

export interface OpenApiObject extends BaseDefinition {
    paths?: PathsObject;
}

export interface InfoObject {
    contact?: ContactObject;
    description?: string;
    license?: LicenseObject;
    termsOfService?: string;
    title: string;
    version: string;
}

export interface ContactObject {
    email?: string;
    name?: string;
    url?: string;
}

export interface LicenseObject {
    name: string;
    url?: string;
}

export interface ServerObject {
    description?: string;
    url: string;
    variables?: Map<ServerVariable>;
}

export interface ServerVariable {
    default: string;
    description?: string;
    enum?: string[];
}

export interface ComponentsObject {
    callbacks?: Map<CallbackObject | ReferenceObject>;
    examples?: Map<ExampleObject | ReferenceObject>;
    headers?: Map<HeaderObject | ReferenceObject>;
    links?: Map<LinkObject | ReferenceObject>;
    parameters?: Map<ParameterObject | ReferenceObject>;
    requestBodies?: Map<ReferenceObject | RequestBodyObject>;
    responses?: Map<ReferenceObject | ResponseObject>;
    schemas?: Map<ReferenceObject | SchemaObject>;
    securitySchemes?: Map<
        ApiKeySecuritySchemeObject | HttpSecuritySchemeObject | Oauth2SecuritySchemeObject | OpenIdConnectSecuritySchemeObject | ReferenceObject
    >;
}

export type PathsObject = Record<string, PathItemObject>;

export interface PathItemObject {
    $ref?: string;
    delete?: OperationObject;
    description?: string;
    get?: OperationObject;
    head?: OperationObject;
    options?: OperationObject;
    parameters?: (ParameterObject | ReferenceObject)[];
    patch?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    servers?: ServerObject[];
    summary?: string;
    trace?: OperationObject;
}

export interface OperationObject {
    callbacks?: Map<CallbackObject | ReferenceObject>;
    deprecated?: boolean;
    description?: string;
    externalDocs?: ExternalDocumentationObject;
    operationId?: string;
    parameters?: (ParameterObject | ReferenceObject)[];
    requestBody?: ReferenceObject | RequestBodyObject;
    responses: ResponsesObject;
    security?: SecurityRequirementObject[];
    servers?: ServerObject[];
    summary?: string;
    tags?: string[];
}

export interface ExternalDocumentationObject {
    description?: string;
    url: string;
}

export interface ParameterObject {
    allowEmptyValue?: boolean;
    allowReserved?: boolean;
    //
    content?: Map<MediaTypeObject>;
    deprecated?: boolean;
    description?: string;
    example?: any;
    examples?: Map<ExampleObject | ReferenceObject>;
    explode?: string;
    in: string;
    name: string;
    required?: boolean;
    schema?: ReferenceObject | SchemaObject;
    //
    style?: string;
    // ignoring stylings: matrix, label, form, simple, spaceDelimited,
    // pipeDelimited and deepObject
}

export interface RequestBodyObject {
    content: Map<MediaTypeObject>;
    description?: string;
    required?: boolean;
}

export interface MediaTypeObject {
    encoding?: Map<EncodingObject>;
    example?: any;
    examples?: Map<ExampleObject | ReferenceObject>;
    schema?: ReferenceObject | SchemaObject;
}

export interface EncodingObject {
    allowReserved?: boolean;
    contentType?: string;
    explode?: boolean;
    headers?: Map<HeaderObject | ReferenceObject>;
    style?: string;
}

export type ResponsesObject = Record<string, ReferenceObject | ResponseObject>;

export interface ResponseObject {
    content?: Map<MediaTypeObject>;
    description: string;
    headers?: Map<HeaderObject | ReferenceObject>;
    links?: Map<LinkObject | ReferenceObject>;
}

export type CallbackObject = Record<string, PathItemObject>;

export interface ExampleObject {
    description?: string;
    externalValue?: string;
    summary?: string;
    value?: any;
}

export interface LinkObject {
    description?: string;
    operationId?: string;
    operationRef?: string;
    parameters?: Map<any>;
    requestBody?: any;
    server?: ServerObject;
}

export interface HeaderObject {
    allowEmptyValue?: boolean;
    allowReserved?: boolean;
    //
    content?: Map<MediaTypeObject>;
    deprecated?: boolean;
    description?: string;
    example?: any;
    examples?: Map<ExampleObject | ReferenceObject>;
    explode?: string;
    required?: boolean;
    schema?: ReferenceObject | SchemaObject;
    //
    style?: string;
    // ignoring stylings: matrix, label, form, simple, spaceDelimited,
    // pipeDelimited and deepObject
}

export interface TagObject {
    description?: string;
    externalDocs?: ExternalDocumentationObject;
    name: string;
}

export interface ReferenceObject {
    $ref: string;
}

// TODO: this could be expanded on.
export type SchemaObject = Record<string, any>;

export interface ApiKeySecuritySchemeObject {
    description?: string;
    in: string;
    name: string;
    type: string;
}

export interface HttpSecuritySchemeObject {
    bearerFormat?: string;
    description?: string;
    scheme: string;
    type: string;
}

export interface Oauth2SecuritySchemeObject {
    description?: string;
    flows: OAuthFlowsObject;
    type: string;
}

export interface OpenIdConnectSecuritySchemeObject {
    description?: string;
    openIdConnectUrl: string;
    type: string;
}

export interface OAuthFlowsObject {
    authorizationCode?: OAuthFlowObject;
    clientCredentials?: OAuthFlowObject;
    implicit?: OAuthFlowObject;
    password?: OAuthFlowObject;
}

export interface OAuthFlowObject {
    authorizationUrl?: string; // required for some?
    refreshUrl: string;
    scopes: Map<string>;
    tokenUrl?: string; // required for some?
}

export type SecurityRequirementObject = Record<string, string[]>;

export type Map<T> = Record<string, T>;
