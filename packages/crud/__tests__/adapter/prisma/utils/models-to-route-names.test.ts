import { describe, expect, it } from "vitest";

import modelsToRouteNames from "../../../../src/adapter/prisma/utils/models-to-route-names";

describe("modelsToRouteNames", () => {
    it("should return a map of models to route names", () => {
        expect(
            modelsToRouteNames(
                {
                    User: {
                        name: "User",
                        plural: "users",
                    },
                },
                ["User"],
            ),
        ).toStrictEqual({
            User: "users",
        });
    });
});
