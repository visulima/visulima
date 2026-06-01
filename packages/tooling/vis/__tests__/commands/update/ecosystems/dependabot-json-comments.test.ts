import { writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadIgnoreRules } from "../../../../src/commands/update/ecosystems/dependabot";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

describe("dependabot/renovate config loader — JSON5 comment strip", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-dependabot-json-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("preserves `//` sequences inside JSON string literals (e.g. URLs)", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "renovate.json"),
            JSON.stringify({
                docsUrl: "https://renovatebot.com/docs/",
                ignoreDeps: ["actions/checkout"],
            }),
        );

        const rules = loadIgnoreRules(workspaceRoot);

        // The URL contains `//` which a naive comment strip would chew
        // through, breaking JSON.parse and silently dropping the entire
        // config. Our string-aware stripper preserves it.
        expect(rules.actions.has("actions/checkout")).toBe(true);
        expect(rules.docker.has("actions/checkout")).toBe(true);
    });

    it("still strips real `//` line comments", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "renovate.json"), ["{", "  // Top-level ignore list", "  \"ignoreDeps\": [\"actions/checkout\"]", "}"].join("\n"));

        const rules = loadIgnoreRules(workspaceRoot);

        expect(rules.actions.has("actions/checkout")).toBe(true);
    });

    it("strips block comments without breaking JSON content", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "renovate.json"), "{\n  /* multi-line block\n     comment */\n  \"ignoreDeps\": [\"actions/checkout\"]\n}\n");

        const rules = loadIgnoreRules(workspaceRoot);

        expect(rules.actions.has("actions/checkout")).toBe(true);
    });
});

describe("dependabot loader — fall through on placeholder files", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-dependabot-fallthrough-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("falls through to renovate.json when renovate.json5 is unparseable", () => {
        expect.assertions(1);

        // First candidate exists but is malformed.
        writeFileSync(join(workspaceRoot, "renovate.json"), "not-json");
        // Second-priority candidate has the real config.
        writeFileSync(join(workspaceRoot, "renovate.json5"), JSON.stringify({ ignoreDeps: ["actions/checkout"] }));

        const rules = loadIgnoreRules(workspaceRoot);

        expect(rules.actions.has("actions/checkout")).toBe(true);
    });
});
