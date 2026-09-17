// @vitest-environment jsdom
import { validateSpec } from "@json-render/core";
import { describe, expect, it } from "vitest";

import type { JsonLdSchema, MetaTags } from "../../../src/apps/seo/analyze";
import { TAG_DEFINITIONS } from "../../../src/apps/seo/analyze";
import buildSeoSpec from "../../../src/apps/seo/spec";
import type { SeoElement } from "../../../src/apps/seo/types";

const emptyMeta: MetaTags = {
    articleAuthor: "",
    articleModifiedTime: "",
    articlePublishedTime: "",
    articleSection: "",
    canonical: "",
    description: "",
    ogDescription: "",
    ogImage: "",
    ogImageAlt: "",
    ogLocale: "",
    ogSiteName: "",
    ogTitle: "",
    ogType: "",
    ogUrl: "",
    title: "",
    twitterCard: "",
    twitterCreator: "",
    twitterDescription: "",
    twitterImage: "",
    twitterImageAlt: "",
    twitterSite: "",
    twitterTitle: "",
};

const schema = (status: JsonLdSchema["status"], index = 0): JsonLdSchema => {
    return {
        context: "https://schema.org",
        index,
        messages: [],
        parsed: { "@type": "Person" },
        raw: "{\"@type\":\"Person\"}",
        status,
        type: "Person",
    };
};

const build = (meta: Partial<MetaTags> = {}, schemas: JsonLdSchema[] = []) => buildSeoSpec({ meta: { ...emptyMeta, ...meta }, schemas });

const elementsOfType = (spec: { elements: Record<string, SeoElement> }, type: SeoElement["type"]): SeoElement[] =>
    Object.values(spec.elements).filter((element) => element.type === type);

const tabsOf = (spec: { elements: Record<string, SeoElement> }) =>
    (elementsOfType(spec, "TabView")[0]?.props as { tabs: { badge?: number; badgeVariant?: string; label: string }[] }).tabs;

describe(buildSeoSpec, () => {
    it("produces a structurally valid spec for an empty page", () => {
        expect.hasAssertions();

        expect(validateSpec(build(), { checkOrphans: true })).toStrictEqual({ issues: [], valid: true });
    });

    it("produces a structurally valid spec for a fully tagged page with schemas", () => {
        expect.hasAssertions();

        const spec = build(
            {
                description: "d",
                ogDescription: "od",
                ogImage: "https://example.com/i.png",
                ogTitle: "ot",
                ogType: "article",
                title: "t",
                twitterCard: "summary",
            },
            [schema("error"), schema("ok", 1)],
        );

        expect(validateSpec(spec, { checkOrphans: true })).toStrictEqual({ issues: [], valid: true });
    });

    it("omits the article group until the page is an article", () => {
        expect.hasAssertions();

        const titles = (meta: Partial<MetaTags>) => elementsOfType(build(meta), "Section").map((element) => (element.props as { title?: string }).title);

        expect(titles({})).not.toContain("Article");
        expect(titles({ ogType: "article" })).toContain("Article");
        expect(titles({ articleAuthor: "Ada" })).toContain("Article");
    });

    it("badges the missing tab as destructive while a required tag is absent", () => {
        expect.hasAssertions();

        const missing = tabsOf(build())[3];

        expect(missing).toStrictEqual({ badge: expect.any(Number), badgeVariant: "destructive", label: "Missing", value: "missing" });
    });

    it("drops the missing badge once every tag is present", () => {
        expect.hasAssertions();

        // Derived from the tag list so a newly tracked tag fails this test
        // rather than quietly leaving a badge behind.
        const complete = Object.fromEntries(TAG_DEFINITIONS.map((definition) => [definition.key, "set"])) as Partial<MetaTags>;

        const missing = tabsOf(build(complete))[3];

        expect(missing).toStrictEqual({ label: "Missing", value: "missing" });
    });

    it("badges structured data with the error count when any schema errors", () => {
        expect.hasAssertions();

        const jsonld = tabsOf(build({}, [schema("error"), schema("warning", 1)]))[4];

        expect(jsonld).toStrictEqual({ badge: 1, badgeVariant: "destructive", label: "Structured Data", value: "jsonld" });
    });

    it("falls back to the warning count when no schema errors", () => {
        expect.hasAssertions();

        const jsonld = tabsOf(build({}, [schema("warning"), schema("warning", 1)]))[4];

        expect(jsonld).toStrictEqual({ badge: 2, badgeVariant: "warning", label: "Structured Data", value: "jsonld" });
    });

    it("drives each schema disclosure from its own state path", () => {
        expect.hasAssertions();

        const spec = build({}, [schema("ok"), schema("ok", 1)]);
        const headers = elementsOfType(spec, "DisclosureHeader");

        expect(headers.map((header) => header.on?.["click"])).toStrictEqual([
            { action: "toggle", params: { path: "/expanded/0" } },
            { action: "toggle", params: { path: "/expanded/1" } },
        ]);
        expect(headers.map((header) => (header.props as { expanded: unknown }).expanded)).toStrictEqual([{ $state: "/expanded/0" }, { $state: "/expanded/1" }]);
    });

    it("hides each schema body behind the path its header toggles", () => {
        expect.hasAssertions();

        const spec = build({}, [schema("ok")]);
        const hidden = Object.values(spec.elements).filter((element) => element.visible !== undefined);

        expect(hidden.map((element) => (element.visible as { $state: string }).$state).sort()).toStrictEqual(["/expanded/0", "/raw/0"]);
    });

    it("labels a schema that came from an @graph with its index", () => {
        expect.hasAssertions();

        const spec = build({}, [{ ...schema("ok"), graphIndex: 2 }]);

        expect((elementsOfType(spec, "DisclosureHeader")[0]?.props as { label: string }).label).toBe("Script 1 @graph[2]");
    });

    it("pluralises the schema summary", () => {
        expect.hasAssertions();

        const one = (elementsOfType(build({}, [schema("ok")]), "SummaryRow")[0]?.props as { left: string }).left;
        const two = (elementsOfType(build({}, [schema("ok"), schema("ok", 1)]), "SummaryRow")[0]?.props as { left: string }).left;

        expect(one).toBe("1 schema detected");
        expect(two).toBe("2 schemas detected");
    });

    it("shows an empty state instead of a summary when there is no structured data", () => {
        expect.hasAssertions();

        const spec = build();

        expect(elementsOfType(spec, "SummaryRow")).toStrictEqual([]);
        expect(elementsOfType(spec, "EmptyState").map((element) => (element.props as { title: string }).title)).toContain("No structured data found");
    });

    it("truncates the serp title to the search-result limit", () => {
        expect.hasAssertions();

        const spec = build({ title: "x".repeat(80) });
        const [desktop] = elementsOfType(spec, "SerpSnippet");

        expect((desktop?.props as { title: string }).title).toHaveLength(60);
    });

    it("truncates the mobile description harder than the desktop one", () => {
        expect.hasAssertions();

        const spec = build({ description: "y".repeat(300) });
        const [desktop, mobile] = elementsOfType(spec, "SerpSnippet");

        expect((desktop?.props as { description: string }).description).toHaveLength(158);
        expect((mobile?.props as { description: string }).description).toHaveLength(120);
    });

    it("lists the tags each platform is missing", () => {
        expect.hasAssertions();

        const spec = build({ ogDescription: "od", ogTitle: "ot" });
        const [facebook] = elementsOfType(spec, "SocialCard");

        expect((facebook?.props as { missing: string[] }).missing).toStrictEqual(["ogImage"]);
    });

    it("is serializable — the spec survives a JSON round trip unchanged", () => {
        expect.hasAssertions();

        const spec = build({ ogType: "article", title: "t" }, [schema("error")]);

        // Deliberately not `structuredClone`: the point is that the spec
        // survives a *JSON* round trip, which is how it reaches an RPC client
        // or an agent. structuredClone keeps `undefined` values that
        // JSON.stringify drops, hiding exactly that class of bug.
        // eslint-disable-next-line unicorn/prefer-structured-clone
        expect(JSON.parse(JSON.stringify(spec))).toStrictEqual(spec);
    });
});
