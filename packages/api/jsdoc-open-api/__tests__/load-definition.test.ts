import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import loadDefinition from "../src/util/load-definition";

describe(loadDefinition, () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "load-definition-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("parses a YAML definition (.yaml)", () => {
        expect.assertions(1);

        const file = join(workDirectory, "definition.yaml");

        writeFileSync(file, "openapi: 3.0.0\ninfo:\n  title: API\n  version: 1.0.0\n");

        expect(loadDefinition(file)).toStrictEqual({
            info: { title: "API", version: "1.0.0" },
            openapi: "3.0.0",
        });
    });

    it("parses a YAML definition (.yml)", () => {
        expect.assertions(1);

        const file = join(workDirectory, "definition.yml");

        writeFileSync(file, "openapi: 3.0.0\ninfo:\n  title: Yml API\n  version: 2.0.0\n");

        expect(loadDefinition(file)).toStrictEqual({
            info: { title: "Yml API", version: "2.0.0" },
            openapi: "3.0.0",
        });
    });

    it("parses a JSON definition (.json)", () => {
        expect.assertions(1);

        const file = join(workDirectory, "definition.json");

        writeFileSync(file, JSON.stringify({ info: { title: "Json API", version: "3.0.0" }, openapi: "3.0.0" }));

        expect(loadDefinition(file)).toStrictEqual({
            info: { title: "Json API", version: "3.0.0" },
            openapi: "3.0.0",
        });
    });

    it("throws when the file extension is neither YAML nor JSON", () => {
        expect.assertions(1);

        const file = join(workDirectory, "definition.txt");

        writeFileSync(file, "not a definition");

        expect(() => loadDefinition(file)).toThrow("OpenAPI definition path must be YAML or JSON.");
    });
});
