import { Text } from "jsx-email";
import { describe, expect, expectTypeOf, it } from "vitest";

import jsxEmail from "../../src/template-engines/jsx-email";

describe("jsx-email template engine", () => {
    it("renders a component element to HTML", async () => {
        expect.assertions(1);

        // Invoking the component as a factory yields the element the renderer expects (no JSX tooling needed).
        const element = Text({ children: "Hello jsx-email" });

        const html = await jsxEmail(element);

        // `expectTypeOf` is a compile-time check and does not count toward `expect.assertions`.
        expectTypeOf(html).toBeString();

        expect(html).toContain("Hello jsx-email");
    });

    it("renders plain text when requested", async () => {
        expect.assertions(1);

        const element = Text({ children: "Plain body" });

        const text = await jsxEmail(element, undefined, { plainText: true });

        expect(text).toContain("Plain body");
    });
});
