import type {
    BaseDefinition,
    ComponentsObject,
    ExternalDocumentationObject,
    InfoObject,
    OpenApiObject,
    PathsObject,
    SecurityRequirementObject,
    ServerObject,
    TagObject,
} from "./exported";
import objectMerge from "./util/object-merge";

class SpecBuilder implements OpenApiObject {
    public components?: ComponentsObject;

    public externalDocs?: ExternalDocumentationObject;

    public info: InfoObject;

    public openapi: string;

    public paths: PathsObject;

    public security?: SecurityRequirementObject[];

    public servers?: ServerObject[];

    public tags?: TagObject[];

    public constructor(baseDefinition: BaseDefinition) {
        this.openapi = baseDefinition.openapi;
        this.info = baseDefinition.info;
        this.servers = baseDefinition.servers;
        this.paths = baseDefinition.paths ?? {};
        this.components = baseDefinition.components;
        this.security = baseDefinition.security;
        this.tags = baseDefinition.tags;
        this.externalDocs = baseDefinition.externalDocs;
    }

    public addData(parsedFile: OpenApiObject[]): void {
        parsedFile.forEach((file) => {
            const { components, paths, ...rest } = file;

            // only merge paths and components
            objectMerge(this, {
                components: components ?? {},
                paths: paths ?? {},
            } as OpenApiObject);

            // overwrite everything else:
            Object.entries(rest).forEach(([key, value]) => {
                // @ts-expect-error
                this[key as keyof OpenApiObject] = value;
            });
        });
    }
}

export default SpecBuilder;
