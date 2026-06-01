import { describe, expect, it } from "vitest";

import type { EcosystemUpdate } from "../../../src/commands/update/ecosystems";
import { ecosystemEntryKey, UpdateStore } from "../../../src/tui/components/update/update-store";
import type { OutdatedEntry } from "../../../src/util/catalog";

const makeOutdated = (overrides: Partial<OutdatedEntry> & Pick<OutdatedEntry, "packageName">): OutdatedEntry => ({
    catalogName: "default",
    current: "1.0.0",
    latest: "2.0.0",
    packageName: overrides.packageName,
    target: "2.0.0",
    updateType: "minor",
    ...overrides,
} as OutdatedEntry);

const makeEcosystemEntry = (overrides: Partial<EcosystemUpdate> = {}): EcosystemUpdate => {
    return {
        currentRef: "v1.0.0",
        currentVersion: "v1.0.0",
        ecosystem: "actions",
        file: "/repo/.github/workflows/ci.yml",
        line: 10,
        name: "actions/checkout",
        newRef: "v2.0.0",
        newVersion: "v2.0.0",
        original: "uses: actions/checkout@v1.0.0",
        replacement: "uses: actions/checkout@v2.0.0",
        updateType: "major",
        ...overrides,
    };
};

describe("updateStore (ecosystem plumbing)", () => {
    it("stores ecosystem entries and seeds the checked set with every key", () => {
        expect.assertions(3);

        const a = makeEcosystemEntry();
        const b = makeEcosystemEntry({ line: 22, name: "actions/setup-node" });
        const store = new UpdateStore([], null, [a, b]);

        const state = store.getSnapshot();

        expect(state.ecosystemEntries).toHaveLength(2);
        expect(state.checkedEcosystemKeys.has(ecosystemEntryKey(a))).toBe(true);
        expect(state.checkedEcosystemKeys.has(ecosystemEntryKey(b))).toBe(true);
    });

    it("returns only checked ecosystem entries from getCheckedEcosystemEntries", () => {
        expect.assertions(2);

        const a = makeEcosystemEntry();
        const b = makeEcosystemEntry({ line: 22, name: "actions/setup-node" });
        const store = new UpdateStore([], null, [a, b]);

        store.toggleEcosystemCheck(ecosystemEntryKey(a));

        const checked = store.getCheckedEcosystemEntries();

        expect(checked).toHaveLength(1);
        expect(checked[0]?.name).toBe("actions/setup-node");
    });

    it("uncheckAllEcosystem clears the set; checkAllEcosystem restores it", () => {
        expect.assertions(2);

        const a = makeEcosystemEntry();
        const b = makeEcosystemEntry({ line: 22, name: "actions/setup-node" });
        const store = new UpdateStore([], null, [a, b]);

        store.uncheckAllEcosystem();

        expect(store.getCheckedEcosystemEntries()).toHaveLength(0);

        store.checkAllEcosystem();

        expect(store.getCheckedEcosystemEntries()).toHaveLength(2);
    });

    it("ecosystemEntryKey uniquely identifies entries by file/line/name", () => {
        expect.assertions(2);

        const a = makeEcosystemEntry();
        const b = makeEcosystemEntry({ line: 22 });

        expect(ecosystemEntryKey(a)).not.toBe(ecosystemEntryKey(b));
        expect(ecosystemEntryKey(a)).toContain("actions/checkout");
    });
});

describe("updateStore (sort cycle)", () => {
    it("default sort preserves input order", () => {
        expect.assertions(1);

        const store = new UpdateStore([makeOutdated({ packageName: "zebra" }), makeOutdated({ packageName: "alpha" })]);

        expect(store.getFilteredEntries().map((entry) => entry.packageName)).toStrictEqual(["zebra", "alpha"]);
    });

    it("`name` sort returns entries alphabetically", () => {
        expect.assertions(1);

        const store = new UpdateStore([makeOutdated({ packageName: "zebra" }), makeOutdated({ packageName: "alpha" })]);

        store.setSortMode("name");

        expect(store.getFilteredEntries().map((entry) => entry.packageName)).toStrictEqual(["alpha", "zebra"]);
    });

    it("`updateType` sort ranks major > minor > patch", () => {
        expect.assertions(1);

        const store = new UpdateStore([
            makeOutdated({ packageName: "p", updateType: "patch" }),
            makeOutdated({ packageName: "m", updateType: "major" }),
            makeOutdated({ packageName: "n", updateType: "minor" }),
        ]);

        store.setSortMode("updateType");

        expect(store.getFilteredEntries().map((entry) => entry.packageName)).toStrictEqual(["m", "n", "p"]);
    });

    it("setSortMode preserves the highlighted package across a re-sort", () => {
        expect.assertions(2);

        const store = new UpdateStore([makeOutdated({ packageName: "zebra" }), makeOutdated({ packageName: "alpha" }), makeOutdated({ packageName: "mango" })]);

        // Highlight "alpha" (index 1 in default order).
        store.setSelectedIndex(1);

        expect(store.getSnapshot().selectedIndex).toBe(1);

        // After name-sort the order is alpha, mango, zebra → "alpha" sits
        // at index 0, not at the old index 1.
        store.setSortMode("name");

        expect(store.getSnapshot().selectedIndex).toBe(0);
    });

    it("cycleSortMode rotates default → name → updateType → severity → default", () => {
        expect.assertions(5);

        const store = new UpdateStore([makeOutdated({ packageName: "p" })]);

        expect(store.getSnapshot().sortMode).toBe("default");

        store.cycleSortMode();

        expect(store.getSnapshot().sortMode).toBe("name");

        store.cycleSortMode();

        expect(store.getSnapshot().sortMode).toBe("updateType");

        store.cycleSortMode();

        expect(store.getSnapshot().sortMode).toBe("severity");

        store.cycleSortMode();

        expect(store.getSnapshot().sortMode).toBe("default");
    });
});
