import { describe, expect, it } from "vitest";

import { renderHandlebars } from "../../src/template-engines/handlebars";
import { createTestEmail, extractLinks } from "../../src/test";

describe(extractLinks, () => {
    it("reads a link rendered by the Handlebars engine, which escapes = and &", () => {
        expect.assertions(1);

        const html = renderHandlebars(`<a href="{{url}}">Verify</a>`, { url: "https://app.example.com/verify?token=abc&lang=en" });

        expect(extractLinks({ html })).toStrictEqual(["https://app.example.com/verify?token=abc&lang=en"]);
    });

    it("ignores image sources, tracking pixels, and CSS urls in HTML", () => {
        expect.assertions(1);

        expect(
            extractLinks({
                html: `<img src="https://cdn.example.com/logo.png"><img src="https://track.example.com/open.gif"><div style="background:url(https://cdn.example.com/bg.png)">Hi</div>`,
            }),
        ).toStrictEqual([]);
    });

    it("returns only the anchor link from a document with a head stylesheet and a style block", () => {
        expect.assertions(1);

        expect(
            extractLinks({
                html: `<head><link rel="stylesheet" href="https://fonts.example.com/a"><style>@import url(https://fonts.example.com/b);</style></head><body><a href="https://app.example.com/verify">V</a></body>`,
            }),
        ).toStrictEqual(["https://app.example.com/verify"]);
    });

    it("ignores base href and URLs inside script blocks and comments", () => {
        expect.assertions(1);

        expect(
            extractLinks({
                html: `<base href="https://cdn.example.com/"><script>var u = "https://tracker.example.com/x";</script><!-- https://old.example.com/y --><p>Hi</p>`,
            }),
        ).toStrictEqual([]);
    });

    it("reads href on an anchor whatever the tag's case, and ignores data-href", () => {
        expect.assertions(1);

        expect(
            extractLinks({
                html: `<A HREF="https://x.example.com/upper">U</A><AREA HREF="https://x.example.com/area"><span data-href="https://x.example.com/data">S</span>`,
            }),
        ).toStrictEqual(["https://x.example.com/upper", "https://x.example.com/area"]);
    });

    it("finds bare URLs in the visible text of HTML", () => {
        expect.assertions(1);

        expect(extractLinks({ html: `<p>Reset at https://app.example.com/reset?t=1 today</p>` })).toStrictEqual(["https://app.example.com/reset?t=1"]);
    });

    it("decodes numeric and named entities in a single pass", () => {
        expect.assertions(1);

        expect(extractLinks({ html: `<a href="https://x.example.com/p?a&#x3D;1&#38;b&#61;2&amp;#x3D;3">Go</a>` })).toStrictEqual([
            "https://x.example.com/p?a=1&b=2&#x3D;3",
        ]);
    });

    it("reads links from a message captured by the test harness", async () => {
        expect.assertions(1);

        const email = createTestEmail();

        await email.mail.send({
            from: { email: "app@example.com" },
            html: `<a href="https://app.example.com/verify?token=abc&amp;lang=en">Verify</a>`,
            subject: "Verify",
            to: { email: "user@example.com" },
        });

        const [entry] = email.sent();

        expect(extractLinks(entry?.options ?? {})).toStrictEqual(["https://app.example.com/verify?token=abc&lang=en"]);
    });

    it("returns href targets from HTML", () => {
        expect.assertions(1);

        expect(extractLinks({ html: `<a href="https://app.example.com/verify?token=abc">Verify</a>` })).toStrictEqual([
            "https://app.example.com/verify?token=abc",
        ]);
    });

    it("decodes &amp; in href targets before returning them", () => {
        expect.assertions(1);

        expect(extractLinks({ html: `<a href="https://x.example.com/confirm?id=7&amp;lang=de">Confirm</a>` })).toStrictEqual([
            "https://x.example.com/confirm?id=7&lang=de",
        ]);
    });

    it("accepts single-quoted href attributes", () => {
        expect.assertions(1);

        expect(extractLinks({ html: `<a href='https://x.example.com/single'>Go</a>` })).toStrictEqual(["https://x.example.com/single"]);
    });

    it("finds bare URLs in plain text and drops trailing punctuation", () => {
        expect.assertions(1);

        expect(extractLinks("Reset your password at https://x.example.com/reset?t=1. The link expires soon.")).toStrictEqual([
            "https://x.example.com/reset?t=1",
        ]);
    });

    it("reads a URL inside angle brackets in plain text", () => {
        expect.assertions(1);

        expect(extractLinks("Visit <https://x.example.com/a> for details")).toStrictEqual(["https://x.example.com/a"]);
    });

    it("returns each URL once when it appears in both html and text", () => {
        expect.assertions(1);

        expect(
            extractLinks({
                html: `<a href="https://x.example.com/once">Once</a>`,
                text: "Open https://x.example.com/once",
            }),
        ).toStrictEqual(["https://x.example.com/once"]);
    });

    it("searches both bodies of a message and keeps html links first", () => {
        expect.assertions(1);

        expect(
            extractLinks({
                html: `<a href="https://x.example.com/html">H</a>`,
                text: "See https://x.example.com/text",
            }),
        ).toStrictEqual(["https://x.example.com/html", "https://x.example.com/text"]);
    });

    it("ignores non-http links", () => {
        expect.assertions(1);

        expect(extractLinks({ html: `<a href="mailto:a@example.com">Mail</a> <a href="tel:+100">Call</a> <a href="/relative">Rel</a>` })).toStrictEqual(
            [],
        );
    });

    it("returns an empty list when there are no links", () => {
        expect.assertions(1);

        expect(extractLinks("No links here.")).toStrictEqual([]);
    });
});
