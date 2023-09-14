import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export interface Options {
    exclude?: string[];
    extensions?: string[];
    followSymlinks?: boolean;
    include: string[];
    outputFilePath: string;
    stopOnInvalid?: boolean;
    swaggerDefinition: { info: OpenAPIV3_1.InfoObject | OpenAPIV3.InfoObject; openapi: string } & (Partial<OpenAPIV3_1.Document> | Partial<OpenAPIV3.Document>);
    verbose?: boolean;
}
