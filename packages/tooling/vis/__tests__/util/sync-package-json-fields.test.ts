import { describe, expect, it } from "vitest";

import { applyFieldChanges, computeFieldChanges, DEFAULT_SYNCED_FIELDS } from "../../src/util/sync-package-json-fields";

describe(computeFieldChanges, () => {
    it("copies a field from root to a package missing that field", () => {
        expect.assertions(2);

        const root = { license: "MIT", name: "root" };
        const pkg = { name: "@scope/a" };

        const changes = computeFieldChanges(root, pkg, { fields: ["license"] });

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ after: "MIT", before: undefined, field: "license" });
    });

    it("skips when the package's value is already deep-equal to root", () => {
        expect.assertions(1);

        const root = {
            engines: { node: ">=22" },
            license: "MIT",
        };
        const pkg = {
            engines: { node: ">=22" },
            license: "MIT",
        };

        expect(computeFieldChanges(root, pkg, { fields: ["license", "engines"] })).toStrictEqual([]);
    });

    it("preserves repository.directory on the package while replacing type and url", () => {
        expect.assertions(2);

        const root = {
            repository: {
                directory: "",
                type: "git",
                url: "https://github.com/visulima/visulima.git",
            },
        };
        const pkg = {
            repository: {
                directory: "packages/foo",
                type: "git",
                url: "https://github.com/old/repo.git",
            },
        };

        const changes = computeFieldChanges(root, pkg, { fields: ["repository"] });

        expect(changes).toHaveLength(1);
        expect(changes[0]?.after).toStrictEqual({
            directory: "packages/foo",
            type: "git",
            url: "https://github.com/visulima/visulima.git",
        });
    });

    it("respects a custom fields list and ignores fields outside it", () => {
        expect.assertions(1);

        const root = {
            author: "Alice",
            license: "MIT",
        };
        const pkg = {
            author: "Bob",
            license: "ISC",
        };

        const changes = computeFieldChanges(root, pkg, { fields: ["license"] });

        expect(changes.map((change) => change.field)).toStrictEqual(["license"]);
    });

    it("skips a field that is missing on root rather than deleting it from the package", () => {
        expect.assertions(1);

        const root = { name: "root" };
        const pkg = { license: "MIT", name: "@scope/a" };

        expect(computeFieldChanges(root, pkg, { fields: ["license"] })).toStrictEqual([]);
    });

    it("adds a field that is missing on the package", () => {
        expect.assertions(2);

        const root = {
            engines: { node: ">=22" },
        };
        const pkg = { name: "@scope/a" };

        const changes = computeFieldChanges(root, pkg, { fields: ["engines"] });

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            after: { node: ">=22" },
            before: undefined,
            field: "engines",
        });
    });

    it("emits one change per drifted field when several fields differ", () => {
        expect.assertions(1);

        const root = {
            author: "Alice",
            bugs: { url: "https://example.com/issues" },
            license: "MIT",
        };
        const pkg = {
            author: "Bob",
            license: "MIT",
        };

        const changes = computeFieldChanges(root, pkg, { fields: [...DEFAULT_SYNCED_FIELDS] });

        expect(new Set(changes.map((change) => change.field))).toStrictEqual(new Set(["author", "bugs"]));
    });

    it("does not mutate the package object when computing changes", () => {
        expect.assertions(2);

        const root = { license: "MIT" };
        const pkg: Record<string, unknown> = { name: "@scope/a" };

        computeFieldChanges(root, pkg, { fields: ["license"] });

        expect(pkg).toStrictEqual({ name: "@scope/a" });
        expect(Object.hasOwn(pkg, "license")).toBe(false);
    });

    it("handles repository on root as a string by replacing it verbatim", () => {
        expect.assertions(1);

        const root = { repository: "visulima/visulima" };
        const pkg = { repository: { type: "git", url: "https://github.com/old/repo.git" } };

        const changes = computeFieldChanges(root, pkg, { fields: ["repository"] });

        expect(changes[0]?.after).toBe("visulima/visulima");
    });
});

describe(applyFieldChanges, () => {
    it("writes computed values onto the package object in place", () => {
        expect.assertions(1);

        const root = { license: "MIT" };
        const pkg: Record<string, unknown> = { name: "@scope/a" };

        const changes = computeFieldChanges(root, pkg, { fields: ["license"] });

        applyFieldChanges(pkg, changes);

        expect(pkg).toStrictEqual({ license: "MIT", name: "@scope/a" });
    });
});
