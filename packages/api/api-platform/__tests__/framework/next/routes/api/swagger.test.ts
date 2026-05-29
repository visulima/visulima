import { describe, expect, it } from "vitest";

import swaggerApiRoute from "../../../../../src/framework/next/routes/api/swagger";

describe("framework/next/routes/api/swagger", () => {
    it("should delegate to swaggerHandler without throwing", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line sonarjs/deprecation -- intentionally exercising the deprecated alias for coverage
            swaggerApiRoute({ swaggerFilePath: "swagger/swagger.json" });
        }).not.toThrow();
    });
});
