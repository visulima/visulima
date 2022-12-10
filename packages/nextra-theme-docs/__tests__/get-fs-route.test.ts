import { describe, expect, it } from "vitest";

import { getFSRoute } from "../src/utils";

const defaultRoute = "/getting-started";

describe("getFSRoute", () => {
    it("replace locale", () => {
        const withLocale = getFSRoute("/getting-started.en-US", "en-US");

        expect(withLocale).toEqual(defaultRoute);
    });

    it("replace index", () => {
        const withIndex = getFSRoute("/getting-started/index");

        expect(withIndex).toEqual(defaultRoute);

        const withIndexAndLocale = getFSRoute("/getting-started/index");

        expect(withIndexAndLocale).toEqual(defaultRoute);
    });

    it("ignore query", () => {
        const withQuery = getFSRoute("/getting-started?query=1");

        expect(withQuery).toEqual(defaultRoute);

        const withQueryLocale = getFSRoute("/getting-started.en-US?query=1", "en-US");

        expect(withQueryLocale).toEqual(defaultRoute);

        const withIndexLocaleQuery = getFSRoute("/getting-started/index.en-US?query=1", "en-US");

        expect(withIndexLocaleQuery).toEqual(defaultRoute);
    });
});
