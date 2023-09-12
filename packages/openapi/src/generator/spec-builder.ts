import type { OpenAPIV3_1 } from "openapi-types";
import merge from "lodash.merge";

class SpecBuilder implements OpenAPIV3_1.Document {
    public components?: OpenAPIV3_1.ComponentsObject;

    public externalDocs?: OpenAPIV3_1.ExternalDocumentationObject;

    public info: OpenAPIV3_1.InfoObject;

    public openapi: string;

    public paths: OpenAPIV3_1.PathsObject;

    public security?: OpenAPIV3_1.SecurityRequirementObject[];

    public servers?: OpenAPIV3_1.ServerObject[];

    public tags?: OpenAPIV3_1.TagObject[];

    public constructor(baseDefinition: OpenAPIV3_1.Document) {
        this.openapi = baseDefinition.openapi;
        this.info = baseDefinition.info;
        this.servers = baseDefinition.servers;
        this.paths = baseDefinition.paths ?? {};
        this.components = baseDefinition.components;
        this.security = baseDefinition.security;
        this.tags = baseDefinition.tags;
        this.externalDocs = baseDefinition.externalDocs;
    }

    public addData(parsedFile: OpenAPIV3_1.Document[]): void {
        parsedFile.forEach((file) => {
            const { components, paths, ...rest } = file;

            // only merge paths and components
            merge(this, {
                components: components ?? {},
                paths: paths ?? {},
            } as OpenAPIV3_1.Document);

            // overwrite everything else:
            Object.entries(rest).forEach(([key, value]) => {
                // @ts-expect-error - find the correct type for this
                this[key as keyof typeof this] = value;
            });
        });
    }
}

export default SpecBuilder;
