import { describe, expect, it } from "vitest";

import getSwaggerTags from "../../../src/swagger/utils/get-swagger-tags";

describe(getSwaggerTags, () => {
    it("should return default tag objects (just name) when no config is given", () => {
        expect.assertions(1);

        const result = getSwaggerTags(["User", "Post"]);

        expect(result).toStrictEqual([{ name: "User" }, { name: "Post" }]);
    });

    it("should prefer explicit tag from modelsConfig", () => {
        expect.assertions(1);

        const result = getSwaggerTags(["User"], {
            User: {
                tag: { description: "Users API", name: "Accounts" },
            },
        });

        expect(result).toStrictEqual([{ description: "Users API", name: "Accounts" }]);
    });

    it("should fall back to default name when individual model has no tag config", () => {
        expect.assertions(1);

        const result = getSwaggerTags(["User", "Post"], {
            User: { tag: { name: "Users" } },
        });

        expect(result).toStrictEqual([{ name: "Users" }, { name: "Post" }]);
    });
});
