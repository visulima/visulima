import { describe, expect, it } from "vitest";

import { createI18nRenderer, renderI18n, resolveLocale } from "../../src/template-engines/i18n";
import type { TemplateRenderer } from "../../src/template-engines/types";

// A tiny mustache-ish renderer for tests (no engine dependency).
const renderer: TemplateRenderer = (template, data) => {
    const name = (data?.name as string | undefined) ?? "";

    return String(template).replaceAll("{{name}}", name);
};

const templates = { de: "Hallo {{name}}", en: "Hello {{name}}" };

describe("i18n renderer", () => {
    describe(resolveLocale, () => {
        it("matches exact, then language subtag, then default", () => {
            expect.assertions(4);
            expect(resolveLocale(templates, "de")).toBe("de");
            expect(resolveLocale(templates, "en-US")).toBe("en");
            expect(resolveLocale(templates, "fr", "en")).toBe("en");
            expect(resolveLocale(templates, "fr")).toBeUndefined();
        });
    });

    describe(renderI18n, () => {
        it("renders the resolved locale template", async () => {
            expect.assertions(2);
            await expect(renderI18n(templates, "de", renderer, { name: "Ada" })).resolves.toBe("Hallo Ada");
            await expect(renderI18n(templates, "en-GB", renderer, { name: "Bob" })).resolves.toBe("Hello Bob");
        });

        it("throws when no locale matches", async () => {
            expect.assertions(1);
            await expect(renderI18n(templates, "fr", renderer)).rejects.toThrow("No template found for locale");
        });
    });

    describe(createI18nRenderer, () => {
        it("binds an engine and default locale", async () => {
            expect.assertions(1);

            const render = createI18nRenderer(renderer, "en");

            await expect(render(templates, "fr", { name: "Cleo" })).resolves.toBe("Hello Cleo");
        });
    });
});
