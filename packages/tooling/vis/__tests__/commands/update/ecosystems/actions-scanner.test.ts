import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractUsesFromContent, scanActionsRepository } from "../../../../src/commands/update/ecosystems/actions/scanner";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

const WORKFLOW = `
name: ci
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.1.1
      - uses: actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a # v4.2.0
      # actions-up-ignore-next-line
      - uses: pnpm/action-setup@v2.4.0
      - uses: docker://alpine:3.19
      - uses: ./local-action
      - uses: actions/cache@v3 # actions-up-ignore: pinned for compatibility
`;

describe(extractUsesFromContent, () => {
    it("extracts every uses: line and drops local/docker forms", () => {
        expect.assertions(3);

        const references = extractUsesFromContent("/tmp/workflow.yml", WORKFLOW);

        // checkout + setup-node + pnpm/action-setup + cache. docker:// and ./local skipped.
        expect(references).toHaveLength(4);
        expect(references.map((reference) => reference.slug)).toStrictEqual([
            "actions/checkout",
            "actions/setup-node",
            "pnpm/action-setup",
            "actions/cache",
        ]);
        expect(references[1]?.isSha).toBe(true);
    });

    it("captures the version-hint trailing comment for SHA pins", () => {
        expect.assertions(1);

        const references = extractUsesFromContent("/tmp/workflow.yml", WORKFLOW);
        const node = references.find((reference) => reference.slug === "actions/setup-node");

        expect(node?.trailingComment).toBe("v4.2.0");
    });

    it("honours `# actions-up-ignore-next-line`", () => {
        expect.assertions(1);

        const references = extractUsesFromContent("/tmp/workflow.yml", WORKFLOW);
        const pnpm = references.find((reference) => reference.slug === "pnpm/action-setup");

        expect(pnpm?.ignoreReason).toBe("actions-up-ignore-next-line");
    });

    it("honours inline `# actions-up-ignore:` comments", () => {
        expect.assertions(1);

        const references = extractUsesFromContent("/tmp/workflow.yml", WORKFLOW);
        const cache = references.find((reference) => reference.slug === "actions/cache");

        // The reason captured after `actions-up-ignore:` is exposed verbatim.
        expect(cache?.ignoreReason).toBe("pinned for compatibility");
    });

    it("does NOT treat the SHA version-hint comment as an ignore directive", () => {
        expect.assertions(1);

        const references = extractUsesFromContent("/tmp/workflow.yml", WORKFLOW);
        const node = references.find((reference) => reference.slug === "actions/setup-node");

        expect(node?.ignoreReason).toBeUndefined();
    });
});

describe(scanActionsRepository, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-actions-scanner-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("finds workflow + composite + root action files", () => {
        expect.assertions(2);

        ensureDirSync(join(workspaceRoot, ".github/workflows"));
        ensureDirSync(join(workspaceRoot, ".github/actions/my-action"));

        writeFileSync(join(workspaceRoot, ".github/workflows/ci.yml"), "jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4\n");
        writeFileSync(join(workspaceRoot, ".github/actions/my-action/action.yml"), "runs:\n  using: composite\n  steps:\n    - uses: actions/setup-node@v4\n");
        writeFileSync(join(workspaceRoot, "action.yml"), "runs:\n  using: composite\n  steps:\n    - uses: actions/cache@v3\n");

        const references = scanActionsRepository(workspaceRoot);
        const slugs = references.map((reference) => reference.slug).toSorted();

        expect(references).toHaveLength(3);
        expect(slugs).toStrictEqual(["actions/cache", "actions/checkout", "actions/setup-node"]);
    });

    it("returns [] when there's nothing to scan", () => {
        expect.assertions(1);

        const references = scanActionsRepository(workspaceRoot);

        expect(references).toStrictEqual([]);
    });
});
