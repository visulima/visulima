import { describe, expect, it } from "vitest";

import { processJsonLdNode, validateJsonLd } from "../../../src/apps/seo/analyze";

const messagesFor = (schema: Record<string, unknown>): string[] => validateJsonLd(schema).map((message) => message.property);

describe(validateJsonLd, () => {
    it("reports a missing @context as an error", () => {
        expect.hasAssertions();

        expect(validateJsonLd({ "@type": "Person", name: "Ada", url: "https://example.com/ada" })).toStrictEqual([
            { message: "@context is missing — should be 'https://schema.org'", property: "@context", severity: "error" },
        ]);
    });

    it("accepts a schema.org subdomain as the context", () => {
        expect.hasAssertions();

        expect(messagesFor({ "@context": "https://www.schema.org", "@type": "Person", name: "Ada", url: "u" })).toStrictEqual([]);
    });

    it("warns when the context is a valid URL that is not schema.org", () => {
        expect.hasAssertions();

        expect(messagesFor({ "@context": "https://example.com", "@type": "Person", name: "Ada", url: "u" })).toStrictEqual(["@context"]);
    });

    it("warns when the context is not a URL at all", () => {
        expect.hasAssertions();

        expect(messagesFor({ "@context": "schema.org", "@type": "Person", name: "Ada", url: "u" })).toStrictEqual(["@context"]);
    });

    it("stops after a missing @type rather than running a validator", () => {
        expect.hasAssertions();

        expect(messagesFor({ "@context": "https://schema.org" })).toStrictEqual(["@type"]);
    });

    it("notes an unknown @type as a suggestion without failing it", () => {
        expect.hasAssertions();

        expect(validateJsonLd({ "@context": "https://schema.org", "@type": "SoftwareApplication" })).toStrictEqual([
            { message: "@type 'SoftwareApplication' is not validated — no known rules for this type", property: "@type", severity: "suggestion" },
        ]);
    });

    it("requires headline, author and datePublished on an Article", () => {
        expect.hasAssertions();

        expect(messagesFor({ "@context": "https://schema.org", "@type": "Article" })).toStrictEqual([
            "headline",
            "author",
            "datePublished",
            "image",
            "description",
        ]);
    });

    it("accepts name in place of headline on an Article", () => {
        expect.hasAssertions();

        expect(
            messagesFor({
                "@context": "https://schema.org",
                "@type": "Article",
                author: { "@type": "Person", name: "Ada", url: "https://example.com/ada" },
                datePublished: "2024-01-15T09:00:00Z",
                description: "d",
                image: "https://example.com/a.png",
                name: "A title",
            }),
        ).toStrictEqual([]);
    });

    it("warns when datePublished is not ISO 8601", () => {
        expect.hasAssertions();

        const properties = messagesFor({
            "@context": "https://schema.org",
            "@type": "Article",
            author: { name: "Ada" },
            datePublished: "15 January 2024",
            description: "d",
            headline: "h",
            image: "i",
        });

        expect(properties).toStrictEqual(["datePublished"]);
    });

    it("accepts a date-only datePublished", () => {
        expect.hasAssertions();

        const properties = messagesFor({
            "@context": "https://schema.org",
            "@type": "Article",
            author: { name: "Ada" },
            datePublished: "2024-01-15",
            description: "d",
            headline: "h",
            image: "i",
        });

        expect(properties).toStrictEqual([]);
    });

    it("warns when an object author has no name", () => {
        expect.hasAssertions();

        const properties = messagesFor({
            "@context": "https://schema.org",
            "@type": "Article",
            author: { "@type": "Person" },
            datePublished: "2024-01-15",
            description: "d",
            headline: "h",
            image: "i",
        });

        expect(properties).toStrictEqual(["author.name"]);
    });

    it("requires a Product to carry offers, a rating or a review", () => {
        expect.hasAssertions();

        expect(messagesFor({ "@context": "https://schema.org", "@type": "Product", name: "Thing" })).toContain("offers");
    });

    it("checks price and currency inside the first offer of an array", () => {
        expect.hasAssertions();

        const properties = messagesFor({
            "@context": "https://schema.org",
            "@type": "Product",
            image: "i",
            name: "Thing",
            offers: [{ "@type": "Offer" }],
        });

        expect(properties).toStrictEqual(["offers.price", "offers.priceCurrency"]);
    });

    it("accepts priceSpecification in place of price", () => {
        expect.hasAssertions();

        const properties = messagesFor({
            "@context": "https://schema.org",
            "@type": "Product",
            image: "i",
            name: "Thing",
            offers: { priceCurrency: "USD", priceSpecification: { price: 10 } },
        });

        expect(properties).toStrictEqual([]);
    });
});

describe(processJsonLdNode, () => {
    it("derives error status when any message is an error", () => {
        expect.hasAssertions();

        expect(processJsonLdNode({ "@type": "Person", name: "Ada", url: "https://example.com/ada" }, 0).status).toBe("error");
    });

    it("derives warning status when the worst message is a warning", () => {
        expect.hasAssertions();

        expect(processJsonLdNode({ "@context": "https://example.com", "@type": "Person", name: "Ada", url: "u" }, 0).status).toBe("warning");
    });

    it("derives suggestion status for an unvalidated type", () => {
        expect.hasAssertions();

        expect(processJsonLdNode({ "@context": "https://schema.org", "@type": "SoftwareApplication" }, 0).status).toBe("suggestion");
    });

    it("derives ok status when nothing is reported", () => {
        expect.hasAssertions();

        expect(processJsonLdNode({ "@context": "https://schema.org", "@type": "Person", name: "Ada", url: "u" }, 0).status).toBe("ok");
    });

    it("keeps the graph index when the node came from an @graph", () => {
        expect.hasAssertions();

        expect(processJsonLdNode({ "@context": "https://schema.org", "@type": "Person", name: "Ada", url: "u" }, 2, 1).graphIndex).toBe(1);
    });
});
