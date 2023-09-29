import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

const openApiVersions = ["2.0", "3.0", "3.1"];

const getOpenApiVersion = (
    specification: OpenAPIV2.Document | OpenAPIV3_1.Document | OpenAPIV3.Document | object,
): {
    specificationType?: "openapi" | "swagger";
    specificationVersion?: string;
    version?: string;
} => {
    let specificationVersion: string | undefined;
    let version: string | undefined;
    let specificationType: "openapi" | "swagger" | undefined;

    openApiVersions.forEach((oVersion) => {
        // @ts-expect-error - TS doesn't like the dynamic property access
        const property = oVersion === "2.0" ? specification.swagger : specification.openapi;

        if (typeof property === "string" && property.startsWith(oVersion)) {
            specificationVersion = property;
            specificationType = oVersion === "2.0" ? "swagger" : "openapi";
            version = oVersion;
        }
    });

    return {
        specificationType,
        specificationVersion,
        version,
    };
};

export default getOpenApiVersion;
