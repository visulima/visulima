import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
// eslint-disable-next-line no-restricted-imports
import merge from "lodash.merge";

const supportedVersions = new Set(["2.0", "3.0.0", "3.0.1", "3.0.2", "3.0.3", "3.1.0"]);

class SpecBuilder {
    public components?: OpenAPIV3_1.ComponentsObject | OpenAPIV3.ComponentsObject;

    public externalDocs?: OpenAPIV3_1.ExternalDocumentationObject;

    public info?: OpenAPIV2.InfoObject | OpenAPIV3_1.InfoObject | OpenAPIV3.InfoObject;

    public openapi?: string;

    public paths?: OpenAPIV2.PathsObject | OpenAPIV3_1.PathsObject | OpenAPIV3.PathsObject;

    // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
    public security?: OpenAPIV2.SecurityRequirementObject[] | OpenAPIV3_1.SecurityRequirementObject[] | OpenAPIV3.SecurityRequirementObject[];

    public servers?: OpenAPIV3_1.ServerObject[] | OpenAPIV3.ServerObject[];

    public swagger?: string;

    // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
    public tags?: OpenAPIV2.TagObject[] | OpenAPIV3_1.TagObject[] | OpenAPIV3.TagObject[];

    public constructor(baseDefinition: Partial<OpenAPIV2.Document> | Partial<OpenAPIV3_1.Document> | Partial<OpenAPIV3.Document>) {
        Object.entries(baseDefinition).forEach(([key, value]) => {
            if (["openapi", "swagger"].includes(key)) {
                this.validateMainKey(key as "openapi" | "swagger", value as string);
            }

            this.setValue(key as keyof SpecBuilder, value);
        });
    }

    private setValue(key: keyof SpecBuilder, value: any) {
        this[key] = value;
    }

    private validateMainKey(key: "openapi" | "swagger", value: string) {
        if (
            this.openapi &&
            key === "openapi" &&
            ["3.0.0", "3.0.1", "3.0.2", "3.0.3"].includes(value) &&
            ["3.0.0", "3.0.1", "3.0.2", "3.0.3"].includes(this.openapi)
        ) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this[key as keyof typeof this] !== undefined && this[key as keyof typeof this] !== value) {
            throw new Error(`Cannot merge ${key}, the versions do not match.`);
        } else if ((this.swagger !== undefined && key === "openapi") || (this.openapi !== undefined && key === "swagger")) {
            throw new Error(`Cannot merge ${key}, you cant mix swagger v2 and swagger v3.`);
        } else if (!supportedVersions.has(value as string)) {
            throw new Error(`Cannot merge ${key}, the version ${value} is not supported.`);
        }
    }

    public addData(data: Partial<OpenAPIV2.Document> | Partial<OpenAPIV3_1.Document> | Partial<OpenAPIV3.Document>): void {
        Object.entries(data).forEach(([key, value]) => {
            if (["components", "paths", "tags"].includes(key)) {
                const defaultValue = key === "tags" ? [] : {};

                merge(this, {
                    [key]: value ?? defaultValue,
                } as OpenAPIV3_1.Document);
            } else if (["openapi", "swagger"].includes(key)) {
                this.validateMainKey(key as "openapi" | "swagger", value as string);

                this.setValue(key as keyof SpecBuilder, value);
            } else {
                this.setValue(key as keyof SpecBuilder, value);
            }
        });
    }
}

export default SpecBuilder;
