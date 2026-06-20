import { describe, expect, it } from "vitest";

import { renderHandlebars } from "../src/template-engines/handlebars";
import { renderLiquid } from "../src/template-engines/liquid";
import { renderString } from "../src/template-engines/string";

describe(renderString, () => {
    it("interpolates flat and nested placeholders", () => {
        expect.assertions(1);

        const out = renderString("Hi {{ user.name }}, code {{code}}", { code: "123", user: { name: "Ada" } });

        expect(out).toBe("Hi Ada, code 123");
    });

    it("renders missing placeholders as empty strings", () => {
        expect.assertions(1);

        expect(renderString("[{{missing}}]", {})).toBe("[]");
    });

    it("throws when the template is not a string", () => {
        expect.assertions(1);

        const notAString = 42 as unknown;

        expect(() => renderString(notAString as string)).toThrow(TypeError);
    });
});

// `handlebars` / `liquidjs` are optional peers (installed as devDeps here so the renderers run).
describe(renderHandlebars, () => {
    it("renders a handlebars template with data", async () => {
        expect.assertions(1);

        await expect(renderHandlebars("<h1>Hello {{name}}!</h1>", { name: "John" })).resolves.toBe("<h1>Hello John!</h1>");
    });
});

describe(renderLiquid, () => {
    it("renders a liquid template with data", async () => {
        expect.assertions(1);

        await expect(renderLiquid("Hello {{ name }}!", { name: "John" })).resolves.toBe("Hello John!");
    });
});
