import { describe, expect, it } from "vitest";

import { parseTemplate, renderTemplate } from "../../src/generate/moon-adapter/tera-subset";

describe(renderTemplate, () => {
    it("should pass through text with no tags", () => {
        expect.assertions(1);

        expect(renderTemplate("plain text", { filename: "x", scope: {} })).toBe("plain text");
    });

    it("should substitute simple {{ var }}", () => {
        expect.assertions(1);

        expect(renderTemplate("Hello {{ name }}!", { filename: "x", scope: { name: "World" } })).toBe("Hello World!");
    });

    it("should apply a single filter", () => {
        expect.assertions(1);

        expect(renderTemplate("{{ name | upper_case }}", { filename: "x", scope: { name: "hello" } })).toBe("HELLO");
    });

    it("should apply chained filters", () => {
        expect.assertions(1);

        expect(renderTemplate("{{ name | snake_case | upper_case }}", { filename: "x", scope: { name: "MyComponent" } })).toBe("MY_COMPONENT");
    });

    it("should resolve dotted paths", () => {
        expect.assertions(1);

        expect(renderTemplate("{{ user.name }}", { filename: "x", scope: { user: { name: "Ada" } } })).toBe("Ada");
    });

    it("should support {% if %} … {% else %} … {% endif %}", () => {
        expect.assertions(2);

        const template = `{% if flag %}yes{% else %}no{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { flag: true } })).toBe("yes");
        expect(renderTemplate(template, { filename: "x", scope: { flag: false } })).toBe("no");
    });

    it("should support {% if not var %}", () => {
        expect.assertions(1);

        const template = `{% if not flag %}empty{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { flag: false } })).toBe("empty");
    });

    it("should support equality conditions", () => {
        expect.assertions(2);

        const template = `{% if mode == "prod" %}prod{% else %}dev{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { mode: "prod" } })).toBe("prod");
        expect(renderTemplate(template, { filename: "x", scope: { mode: "dev" } })).toBe("dev");
    });

    it("should support {% for x in items %} … {% endfor %}", () => {
        expect.assertions(1);

        const template = `{% for item in items %}- {{ item }}\n{% endfor %}`;

        expect(renderTemplate(template, { filename: "x", scope: { items: ["a", "b", "c"] } })).toBe("- a\n- b\n- c\n");
    });

    it("should support nested for loops", () => {
        expect.assertions(1);

        const template = `{% for row in rows %}{% for col in row %}{{ col }}{% endfor %}\n{% endfor %}`;

        expect(
            renderTemplate(template, {
                filename: "x",
                scope: {
                    rows: [
                        ["a", "b"],
                        ["c", "d"],
                    ],
                },
            }),
        ).toBe("ab\ncd\n");
    });

    it("should support {% include %} for partials", () => {
        expect.assertions(1);

        const partials = new Map([["greeting", parseTemplate("Hello {{ name }}!", "greeting")]]);
        const template = `Top: {% include "greeting" %}`;

        expect(renderTemplate(template, { filename: "x", partials, scope: { name: "World" } })).toBe("Top: Hello World!");
    });

    it("should error with file:line on unsupported {% set %}", () => {
        expect.assertions(2);

        expect(() => renderTemplate("{% set x = 1 %}", { filename: "tpl.tera", scope: {} })).toThrow(/tpl.tera:1/);
        expect(() => renderTemplate("{% set x = 1 %}", { filename: "tpl.tera", scope: {} })).toThrow(/not supported/);
    });

    it("should error with file:line on unsupported {% extends %}", () => {
        expect.assertions(1);

        expect(() => renderTemplate('{% extends "base" %}', { filename: "tpl.tera", scope: {} })).toThrow(/extends.*not supported/);
    });

    it("should error with file:line on unsupported {% macro %}", () => {
        expect.assertions(1);

        expect(() => renderTemplate("{% macro foo() %}", { filename: "tpl.tera", scope: {} })).toThrow(/macro.*not supported/);
    });

    it("should error on unterminated {% if %}", () => {
        expect.assertions(1);

        expect(() => renderTemplate("{% if x %}", { filename: "tpl.tera", scope: { x: true } })).toThrow(/Unterminated.*if/);
    });

    it("should error on unterminated {% for %}", () => {
        expect.assertions(1);

        expect(() => renderTemplate("{% for x in items %}", { filename: "tpl.tera", scope: { items: [] } })).toThrow(/Unterminated.*for/);
    });

    it("should report line numbers across multiline templates", () => {
        expect.assertions(1);

        const template = `line 1\nline 2\n{% set x = 1 %}\n`;

        expect(() => renderTemplate(template, { filename: "tpl.tera", scope: {} })).toThrow(/tpl.tera:3/);
    });

    it("should throw on undefined variables in {{ }}", () => {
        expect.assertions(2);

        expect(() => renderTemplate("{{ missing }}", { filename: "tpl.tera", scope: {} })).toThrow(/not defined/);
        expect(() => renderTemplate("{{ missing }}", { filename: "tpl.tera", scope: {} })).toThrow(/tpl.tera:1/);
    });

    it("should treat undefined variables as falsy in {% if %} conditions", () => {
        expect.assertions(2);

        const template = `{% if missing %}bad{% else %}good{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: {} })).toBe("good");
        expect(renderTemplate(template, { filename: "x", scope: { missing: true } })).toBe("bad");
    });

    it("should support {% if a and b %}", () => {
        expect.assertions(3);

        const template = `{% if a and b %}yes{% else %}no{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { a: true, b: true } })).toBe("yes");
        expect(renderTemplate(template, { filename: "x", scope: { a: true, b: false } })).toBe("no");
        expect(renderTemplate(template, { filename: "x", scope: { a: false, b: true } })).toBe("no");
    });

    it("should support {% if a or b %}", () => {
        expect.assertions(3);

        const template = `{% if a or b %}yes{% else %}no{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { a: true, b: false } })).toBe("yes");
        expect(renderTemplate(template, { filename: "x", scope: { a: false, b: true } })).toBe("yes");
        expect(renderTemplate(template, { filename: "x", scope: { a: false, b: false } })).toBe("no");
    });

    it("should respect operator precedence (or below and below ==)", () => {
        expect.assertions(2);

        // `a and b or c` → `(a and b) or c`
        const template = `{% if a and b or c %}yes{% else %}no{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { a: true, b: false, c: true } })).toBe("yes");
        expect(renderTemplate(template, { filename: "x", scope: { a: true, b: false, c: false } })).toBe("no");
    });

    it("should support parenthesised conditions", () => {
        expect.assertions(2);

        const template = `{% if (a or b) and c %}yes{% else %}no{% endif %}`;

        expect(renderTemplate(template, { filename: "x", scope: { a: false, b: true, c: true } })).toBe("yes");
        expect(renderTemplate(template, { filename: "x", scope: { a: false, b: true, c: false } })).toBe("no");
    });

    it("should short-circuit `and`/`or` (don't throw on right side when left determines result)", () => {
        expect.assertions(2);

        // `missing` would throw in strict mode but short-circuit skips it.
        const templateAnd = `{% if a and missing %}x{% else %}skipped{% endif %}`;
        const templateOr = `{% if a or missing %}x{% else %}skipped{% endif %}`;

        expect(renderTemplate(templateAnd, { filename: "x", scope: { a: false } })).toBe("skipped");
        expect(renderTemplate(templateOr, { filename: "x", scope: { a: true } })).toBe("x");
    });

    it("should apply path_join and path_relative filters", () => {
        expect.assertions(2);

        expect(renderTemplate(`{{ base | path_join("sub", "file.ts") }}`, { filename: "x", scope: { base: "src" } })).toBe("src/sub/file.ts");
        expect(renderTemplate(`{{ target | path_relative("/a/b") }}`, { filename: "x", scope: { target: "/a/b/c/d" } })).toBe("c/d");
    });
});
