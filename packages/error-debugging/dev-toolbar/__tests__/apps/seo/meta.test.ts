// @vitest-environment jsdom
import "../../setup";

import { afterEach, describe, expect, it } from "vitest";

import { readMetaTags } from "../../../src/apps/seo/analyze";

const head = (html: string): void => {
    document.head.innerHTML = html;
};

afterEach(() => {
    document.head.innerHTML = "";
    document.title = "";
});

describe(readMetaTags, () => {
    it("reads the document title", () => {
        expect.hasAssertions();

        document.title = "A page";

        expect(readMetaTags().title).toBe("A page");
    });

    it("reads a name-based meta tag", () => {
        expect.hasAssertions();

        head("<meta name=\"description\" content=\"A description\">");

        expect(readMetaTags().description).toBe("A description");
    });

    it("reads open graph tags by property, not by name", () => {
        expect.hasAssertions();

        head("<meta property=\"og:title\" content=\"OG title\"><meta property=\"og:image:alt\" content=\"Alt\">");

        const meta = readMetaTags();

        expect(meta.ogTitle).toBe("OG title");
        expect(meta.ogImageAlt).toBe("Alt");
    });

    it("reads twitter tags written as name", () => {
        expect.hasAssertions();

        head("<meta name=\"twitter:card\" content=\"summary\">");

        expect(readMetaTags().twitterCard).toBe("summary");
    });

    it("falls back to property for twitter tags, which both spellings appear as in the wild", () => {
        expect.hasAssertions();

        head("<meta property=\"twitter:creator\" content=\"@someone\">");

        expect(readMetaTags().twitterCreator).toBe("@someone");
    });

    it("prefers the name spelling when a twitter tag is given both ways", () => {
        expect.hasAssertions();

        head("<meta name=\"twitter:title\" content=\"from name\"><meta property=\"twitter:title\" content=\"from property\">");

        expect(readMetaTags().twitterTitle).toBe("from name");
    });

    it("reads article tags by property", () => {
        expect.hasAssertions();

        head("<meta property=\"article:published_time\" content=\"2024-01-15T09:00:00Z\">");

        expect(readMetaTags().articlePublishedTime).toBe("2024-01-15T09:00:00Z");
    });

    it("reads the canonical link's resolved href", () => {
        expect.hasAssertions();

        head("<link rel=\"canonical\" href=\"/here\">");

        expect(readMetaTags().canonical).toBe("http://localhost/here");
    });

    it("reports an absent tag as an empty string, never undefined", () => {
        expect.hasAssertions();

        const meta = readMetaTags();

        expect(Object.values(meta).every((value) => value === "")).toBe(true);
    });
});
