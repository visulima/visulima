import { describe, expect, it } from "vitest";

import { RouteType } from "../../../src";
import getModelsAccessibleRoutes from "../../../src/swagger/utils/get-models-accessible-routes";

describe(getModelsAccessibleRoutes, () => {
    it("should return all routes for each model when no models config is given", () => {
        expect.assertions(1);

        const result = getModelsAccessibleRoutes(["User"]);

        expect(result).toStrictEqual({
            User: [RouteType.READ_ALL, RouteType.READ_ONE, RouteType.UPDATE, RouteType.DELETE, RouteType.CREATE],
        });
    });

    it("should respect per-model only filter", () => {
        expect.assertions(1);

        const result = getModelsAccessibleRoutes(["User"], {
            User: { only: [RouteType.READ_ALL] },
        });

        expect(result).toStrictEqual({ User: [RouteType.READ_ALL] });
    });

    it("should respect per-model exclude filter", () => {
        expect.assertions(1);

        const result = getModelsAccessibleRoutes(["User"], {
            User: { exclude: [RouteType.DELETE] },
        });

        expect(result.User).not.toContain(RouteType.DELETE);
    });

    it("should default to empty routes when defaultExposeStrategy is none and no models config", () => {
        expect.assertions(1);

        const result = getModelsAccessibleRoutes(["User"], undefined, "none");

        expect(result).toStrictEqual({ User: [] });
    });
});
