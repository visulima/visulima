import { describe, expect, it } from "vitest";

import { RouteType } from "../../../src";
import getSwaggerPaths from "../../../src/swagger/utils/get-swagger-paths";

describe(getSwaggerPaths, () => {
    it("should generate collection and item paths for all CRUD routes", () => {
        expect.assertions(7);

        const result = getSwaggerPaths({
            routes: {
                User: [RouteType.READ_ALL, RouteType.READ_ONE, RouteType.CREATE, RouteType.UPDATE, RouteType.DELETE],
            },
        });

        expect(result).toHaveProperty("/User");
        expect(result).toHaveProperty("/User/{id}");
        expect(result["/User"]).toHaveProperty("get");
        expect(result["/User"]).toHaveProperty("post");
        expect(result["/User/{id}"]).toHaveProperty("get");
        expect(result["/User/{id}"]).toHaveProperty("put");
        expect(result["/User/{id}"]).toHaveProperty("delete");
    });

    it("should respect custom route name from models config", () => {
        expect.assertions(2);

        const result = getSwaggerPaths({
            models: { User: { name: "people" } },
            routes: { User: [RouteType.READ_ALL] },
        });

        expect(result).toHaveProperty("/people");
        expect(result).not.toHaveProperty("/User");
    });

    it("should respect routesMap pluralization when models config has no name", () => {
        expect.assertions(1);

        const result = getSwaggerPaths({
            routes: { User: [RouteType.READ_ALL] },
            routesMap: { User: "users" },
        });

        expect(result).toHaveProperty("/users");
    });

    it("should add id path parameter to item-level methods", () => {
        expect.assertions(1);

        const result = getSwaggerPaths({
            routes: { User: [RouteType.READ_ONE] },
        });

        const params = result["/User/{id}"]?.get?.parameters as { in: string; name: string; required?: boolean }[];
        const idParameter = params.find((p) => p.name === "id");

        expect(idParameter).toMatchObject({ in: "path", name: "id", required: true });
    });

    it("should attach create body schema for CREATE route", () => {
        expect.assertions(1);

        const result = getSwaggerPaths({
            routes: { User: [RouteType.CREATE] },
        });

        const post = result["/User"]?.post as { requestBody?: { content: Record<string, { schema: { $ref: string } }> } };

        expect(post.requestBody?.content["application/json"].schema.$ref).toBe("#/components/schemas/CreateUser");
    });

    it("should attach update body schema for UPDATE route", () => {
        expect.assertions(1);

        const result = getSwaggerPaths({
            routes: { User: [RouteType.UPDATE] },
        });

        const put = result["/User/{id}"]?.put as { requestBody?: { content: Record<string, { schema: { $ref: string } }> } };

        expect(put.requestBody?.content["application/json"].schema.$ref).toBe("#/components/schemas/UpdateUser");
    });

    it("should use modelsConfig tag.name when provided", () => {
        expect.assertions(1);

        const result = getSwaggerPaths({
            modelsConfig: { User: { tag: { name: "AuthN" } } },
            routes: { User: [RouteType.READ_ALL] },
        });

        const get = result["/User"]?.get as { tags: string[] };

        expect(get.tags).toStrictEqual(["AuthN"]);
    });
});
