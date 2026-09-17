// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import type { JsonLdSchema, MetaTags } from "../../../src/apps/seo/analyze";
import GroupHeading from "../../../src/apps/seo/components/group-heading";
import RawToggleRow from "../../../src/apps/seo/components/raw-toggle-row";
import SummaryRow from "../../../src/apps/seo/components/summary-row";
import buildSeoSpec from "../../../src/apps/seo/spec";
import type { JsonViewRegistry } from "../../../src/json-view";
import { baseActions, baseRegistry, JsonView } from "../../../src/json-view";

afterEach(cleanup);

const registry: JsonViewRegistry = { ...baseRegistry, GroupHeading, RawToggleRow, SummaryRow };

const meta: MetaTags = {
    articleAuthor: "",
    articleModifiedTime: "",
    articlePublishedTime: "",
    articleSection: "",
    canonical: "",
    description: "A page description",
    ogDescription: "OG description",
    ogImage: "",
    ogImageAlt: "",
    ogLocale: "",
    ogSiteName: "",
    ogTitle: "OG title",
    ogType: "",
    ogUrl: "",
    title: "Page title",
    twitterCard: "",
    twitterCreator: "",
    twitterDescription: "",
    twitterImage: "",
    twitterImageAlt: "",
    twitterSite: "",
    twitterTitle: "",
};

const schemas: JsonLdSchema[] = [
    {
        context: "https://schema.org",
        index: 0,
        messages: [{ message: "author is required", property: "author", severity: "error" }],
        parsed: { "@type": "Article" },
        raw: "{\"@type\":\"Article\"}",
        status: "error",
        type: "Article",
    },
];

const renderPanel = () => render(<JsonView actions={baseActions} registry={registry} spec={buildSeoSpec({ meta, schemas })} />);

describe("seo panel", () => {
    it("opens on the social previews tab with one card per platform", () => {
        expect.hasAssertions();

        renderPanel();

        expect(screen.getByText("Facebook")).toBeInTheDocument();
        expect(screen.getAllByText("Missing: ogImage")).toHaveLength(2);
        expect(screen.getByText("Missing: twitterTitle, twitterDescription, twitterImage, twitterCard")).toBeInTheDocument();
    });

    it("renders the meta tags tab from the spec, flagging absent required tags", () => {
        expect.hasAssertions();

        renderPanel();
        fireEvent.click(screen.getByRole("tab", { name: "Meta Tags" }));

        expect(screen.getByText("Page title")).toBeInTheDocument();
        expect(screen.getByText("og:image")).toBeInTheDocument();
        expect(screen.getAllByText("⚠ Missing").length).toBeGreaterThan(0);
    });

    it("expands a schema through the toggle action, with no stateful component", () => {
        expect.hasAssertions();

        renderPanel();
        fireEvent.click(screen.getByRole("tab", { name: /^Structured Data/ }));

        expect(screen.getByText("1 schema detected")).toBeInTheDocument();
        expect(screen.queryByText("author is required")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { expanded: false }));

        expect(screen.getByText("author is required")).toBeInTheDocument();
    });

    it("reveals the raw JSON behind its own state path", () => {
        expect.hasAssertions();

        renderPanel();
        fireEvent.click(screen.getByRole("tab", { name: /^Structured Data/ }));
        fireEvent.click(screen.getByRole("button", { expanded: false }));

        expect(screen.queryByText("{\"@type\":\"Article\"}")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Show raw JSON" }));

        expect(screen.getByText("{\"@type\":\"Article\"}")).toBeInTheDocument();
    });

    it("badges the missing tab with the number of absent tags", () => {
        expect.hasAssertions();

        renderPanel();

        expect(screen.getByRole("tab", { name: /^Missing/ })).toHaveTextContent(/Missing\d+/);
    });
});
