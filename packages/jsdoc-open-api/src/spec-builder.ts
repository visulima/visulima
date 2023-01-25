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
} from "./exported.d";
import objectMerge from "./util/object-merge";

class SpecBuilder implements OpenApiObject {
    public openapi: string;

    public info: InfoObject;

    public servers?: ServerObject[];

    public paths: PathsObject;

    public components?: ComponentsObject;

    public security?: SecurityRequirementObject[];

    public tags?: TagObject[];

    public externalDocs?: ExternalDocumentationObject;

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
            const { paths, components, ...rest } = file;

            // only merge paths and components
            objectMerge(this, {
                paths: paths ?? {},
                components: components ?? {},
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
