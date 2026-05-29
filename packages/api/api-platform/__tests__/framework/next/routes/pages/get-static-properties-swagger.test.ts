import type { OpenAPIV3 } from "openapi-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import getStaticProperties from "../../../../../src/framework/next/routes/pages/get-static-properties-swagger";

const swaggerDocument: OpenAPIV3.Document = {
    info: { title: "Test", version: "1.0.0" },
    openapi: "3.0.0",
    paths: {},
};

describe("framework/next/routes/pages/get-static-properties-swagger", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should fetch the swagger url and return cloned props", async () => {
        expect.assertions(4);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: () => Promise.resolve(swaggerDocument),
        } as Response);

        const getStaticProps = getStaticProperties("https://example.test/swagger.json");

        const result = await getStaticProps({});

        expect(fetchSpy).toHaveBeenCalledWith("https://example.test/swagger.json");

        if (!("props" in result)) {
            throw new Error("Expected getStaticProps to return props");
        }

        const { props } = result;

        expect(props.swaggerUrl).toBe("https://example.test/swagger.json");
        expect(props.swaggerData).toStrictEqual(swaggerDocument);
        expect(props.swaggerData).not.toBe(swaggerDocument);
    });
});
