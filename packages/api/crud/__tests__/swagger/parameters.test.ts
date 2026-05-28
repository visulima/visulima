import { describe, expect, it } from "vitest";

import { RouteType } from "../../src";
import { commonQueryParameters, getQueryParameters, listQueryParameters } from "../../src/swagger/parameters";

describe("swagger parameters", () => {
    it("should expose common parameters (select, include)", () => {
        expect.assertions(2);

        const names = commonQueryParameters.map((p) => p.name);

        expect(names).toContain("select");
        expect(names).toContain("include");
    });

    it("should expose extended list parameters (limit/skip/where/orderBy/page/distinct)", () => {
        expect.assertions(6);

        const names = listQueryParameters.map((p) => p.name);

        expect(names).toContain("limit");
        expect(names).toContain("skip");
        expect(names).toContain("where");
        expect(names).toContain("orderBy");
        expect(names).toContain("page");
        expect(names).toContain("distinct");
    });

    it("should return list parameters for READ_ALL", () => {
        expect.assertions(1);

        const result = getQueryParameters(RouteType.READ_ALL);

        expect(result.map((p) => p.name)).toStrictEqual(listQueryParameters.map((p) => p.name));
    });

    it("should return only common params for non READ_ALL routes", () => {
        expect.assertions(1);

        const result = getQueryParameters(RouteType.READ_ONE);

        expect(result.map((p) => p.name)).toStrictEqual(commonQueryParameters.map((p) => p.name));
    });

    it("should append additional params for non READ_ALL routes", () => {
        expect.assertions(1);

        const extra = { description: "extra", name: "extra", schema: { type: "string" as const } };
        const result = getQueryParameters(RouteType.CREATE, [extra]);

        expect(result.map((p) => p.name)).toContain("extra");
    });

    it("should append additional params for READ_ALL routes", () => {
        expect.assertions(1);

        const extra = { description: "extra", name: "extra", schema: { type: "string" as const } };
        const result = getQueryParameters(RouteType.READ_ALL, [extra]);

        expect(result.map((p) => p.name)).toContain("extra");
    });
});
