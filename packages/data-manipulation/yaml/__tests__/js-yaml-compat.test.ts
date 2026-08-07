import { describe, expect, it } from "vitest";

import { dump, load, loadAll } from "../src";

/**
 * These exercise the `js-yaml`-compatible alias surface (`load`, `loadAll`,
 * `dump`) and mirror behaviours asserted by the upstream `js-yaml` test suite.
 */
describe("js-yaml compat › load", () => {
    it("load is an alias for parsing a single document", () => {
        expect.assertions(1);

        expect(load("a: 1\nb: [2, 3]")).toStrictEqual({ a: 1, b: [2, 3] });
    });

    it("loadAll returns every document as an array", () => {
        expect.assertions(1);

        expect(loadAll("---\n- 1\n---\n- 2")).toStrictEqual([[1], [2]]);
    });

    it("loadAll invokes an iterator per document", () => {
        expect.assertions(1);

        const documents: unknown[] = [];

        loadAll("---\nx: 1\n---\ny: 2", (document) => {
            documents.push(document);
        });

        expect(documents).toStrictEqual([{ x: 1 }, { y: 2 }]);
    });
});

describe("js-yaml compat › dump", () => {
    it("dump is an alias for stringify", () => {
        expect.assertions(1);

        expect(dump({ hello: "world" })).toBe("hello: world\n");
    });

    it("round-trips a representative config document", () => {
        expect.assertions(1);

        const config = {
            build: { minify: true, targets: ["es2022", "node18"] },
            name: "my-app",
            scripts: { start: "node ." },
            version: "1.0.0",
        };

        expect(load(dump(config))).toStrictEqual(config);
    });
});

describe("js-yaml compat › known fixtures", () => {
    it("parses the canonical invoice example", () => {
        expect.assertions(1);

        const source = [
            "invoice: 34843",
            "date: 2001-01-23",
            "bill-to:",
            "  given: Chris",
            "  family: Dumars",
            "product:",
            "  - sku: BL394D",
            "    quantity: 4",
            "    description: Basketball",
            "  - sku: BL4438H",
            "    quantity: 1",
            "    description: Super Hoop",
            "total: 4443.52",
        ].join("\n");

        expect(load(source)).toStrictEqual({
            "bill-to": { family: "Dumars", given: "Chris" },
            // core schema keeps timestamps as strings
            date: "2001-01-23",
            invoice: 34_843,
            product: [
                { description: "Basketball", quantity: 4, sku: "BL394D" },
                { description: "Super Hoop", quantity: 1, sku: "BL4438H" },
            ],
            total: 4443.52,
        });
    });

    it("handles the spec's block/flow mix", () => {
        expect.assertions(1);

        const source = ["- [name        , hr, avg  ]", "- [Mark McGwire, 65, 0.278]", "- [Sammy Sosa  , 63, 0.288]"].join("\n");

        expect(load(source)).toStrictEqual([
            ["name", "hr", "avg"],
            ["Mark McGwire", 65, 0.278],
            ["Sammy Sosa", 63, 0.288],
        ]);
    });
});
