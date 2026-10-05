import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { restOpenApiSpec, transformOpenApiSpec, tusOpenApiSpec, xhrOpenApiSpec } from "../../src/openapi";

const specs: Record<string, Partial<OpenAPIV3.Document>> = {
    rest: restOpenApiSpec("http://localhost", "/files-rest"),
    transform: transformOpenApiSpec("/files"),
    tus: tusOpenApiSpec("/files-tus"),
    xhr: xhrOpenApiSpec("http://localhost", "/files"),
};

const operations = (spec: Partial<OpenAPIV3.Document>): OpenAPIV3.OperationObject[] =>
    Object.values(spec.paths ?? {}).flatMap((item) =>
        Object.entries(item ?? {})
            .filter(([method]) => ["delete", "get", "head", "options", "patch", "post", "put"].includes(method))
            .map(([, operation]) => operation as OpenAPIV3.OperationObject),
    );

const resolveParameter = (spec: Partial<OpenAPIV3.Document>, parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject): OpenAPIV3.ParameterObject =>
    "$ref" in parameter ? (spec.components?.parameters?.[parameter.$ref.split("/").pop() as string] as OpenAPIV3.ParameterObject) : parameter;

describe("openapi specs", () => {
    it.each(Object.entries(specs))("%s is a complete document with valid operation ids and required path params", (_, spec) => {
        expect.hasAssertions();

        expect(spec.openapi).toBe("3.0.3");
        expect(spec.info?.title).toStrictEqual(expect.any(String));

        const ids = operations(spec).map((operation) => operation.operationId);

        expect(new Set(ids).size).toBe(ids.length);

        for (const id of ids) {
            expect(id).toMatch(/^[A-Z_]\w*$/i);
        }

        for (const operation of operations(spec)) {
            for (const parameter of operation.parameters ?? []) {
                const resolved = resolveParameter(spec, parameter);

                if (resolved.in === "path") {
                    expect(resolved.required).toBe(true);
                }
            }
        }
    });

    it("describes REST PATCH as 202 partial / 200 complete and PUT conflicts", () => {
        expect.assertions(5);

        const item = specs.rest.paths?.["/files-rest/{id}"] as OpenAPIV3.PathItemObject;

        expect(Object.keys(item.patch?.responses ?? {})).toContain("202");
        expect(Object.keys(item.patch?.responses ?? {})).not.toContain("201");
        expect(Object.keys(item.put?.responses ?? {})).toEqual(expect.arrayContaining(["400", "409"]));

        const post = (specs.rest.paths?.["/files-rest"] as OpenAPIV3.PathItemObject).post as OpenAPIV3.OperationObject;

        expect(Object.keys(post.responses)).not.toContain("200");
        expect((post.responses["201"] as OpenAPIV3.ResponseObject).headers).toHaveProperty("X-Upload-ID");
    });

    it("has no TUS list endpoint and no unrouted transform path", () => {
        expect.assertions(2);

        expect((specs.tus.paths?.["/files-tus"] as OpenAPIV3.PathItemObject).get).toBeUndefined();
        expect(specs.transform.paths?.["/files/{id}/transform"]).toBeUndefined();
    });

    it("references the TUS Upload-Offset schema for the PATCH response header", () => {
        expect.assertions(1);

        const patch = (specs.tus.paths?.["/files-tus/{id}"] as OpenAPIV3.PathItemObject).patch as OpenAPIV3.OperationObject;

        expect((patch.responses["204"] as OpenAPIV3.ResponseObject).headers?.["Upload-Offset"]).toEqual({
            schema: { $ref: "#/components/schemas/Upload-Offset" },
        });
    });
});
