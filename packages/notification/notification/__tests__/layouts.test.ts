import { describe, expect, it } from "vitest";

import defineLayout from "../src/layouts/define-layout";

describe(defineLayout, () => {
    it("injects rendered content into the default {{content}} slot", async () => {
        expect.assertions(1);

        const layout = defineLayout({
            template: "<main>{{content}}</main>",
        });

        await expect(layout.render("<p>Hi</p>")).resolves.toBe("<main><p>Hi</p></main>");
    });

    it("exposes layout variables alongside the slot", async () => {
        expect.assertions(1);

        const layout = defineLayout({
            template: `<footer><a href="{{unsubscribeUrl}}">unsubscribe</a></footer>{{content}}`,
        });

        await expect(layout.render("body", { unsubscribeUrl: "https://app/u/1" })).resolves.toBe(
            `<footer><a href="https://app/u/1">unsubscribe</a></footer>body`,
        );
    });

    it("supports a custom slot name", async () => {
        expect.assertions(1);

        const layout = defineLayout({
            slot: "body",
            template: "[{{body}}]",
        });

        await expect(layout.render("x")).resolves.toBe("[x]");
    });

    it("does not HTML-escape the injected content with the default renderer", async () => {
        expect.assertions(1);

        const layout = defineLayout({ template: "{{content}}" });

        await expect(layout.render("<b>bold</b>")).resolves.toBe("<b>bold</b>");
    });
});
