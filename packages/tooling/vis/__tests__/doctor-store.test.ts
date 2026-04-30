import { describe, expect, it } from "vitest";

import { DoctorStore } from "../src/tui/components/doctor/DoctorStore";
import type { DoctorFinding } from "../src/tui/components/doctor/findings";

const make = (
    section: DoctorFinding["section"],
    title: string,
    severity: DoctorFinding["severity"] = "warn",
): DoctorFinding => {
    return {
        diagnostic: { id: title, message: title, status: "warn" },
        id: `runtime:${title}`,
        kind: "runtime",
        section,
        severity,
        title,
    };
};

const sample = (): DoctorFinding[] => [
    make("dependencies", "alpha", "warn"),
    make("dependencies", "bravo"),
    make("security", "charlie", "error"),
    make("optimization", "delta"),
    make("runtime", "echo"),
];

describe(DoctorStore, () => {
    it("seeds entries with the first active section selected", () => {
        const store = new DoctorStore(sample());
        const state = store.getSnapshot();

        expect(state.filterType).toBe("dependencies");
        expect(state.entries.map((f) => f.title)).toEqual(["alpha", "bravo"]);
        expect([...state.grouped.keys()]).toEqual(["dependencies"]);
        expect(state.selectedIndex).toBe(0);
        expect(state.focusedPanel).toBe("list");
    });

    it("filters by section type and resets selection", () => {
        const store = new DoctorStore(sample());

        store.setSelectedIndex(3);
        store.setFilterType("security");

        const state = store.getSnapshot();

        expect(state.entries.map((f) => f.title)).toEqual(["charlie"]);
        expect(state.selectedIndex).toBe(0);
        expect([...state.grouped.keys()]).toEqual(["security"]);
    });

    it("filters by free text case-insensitively against title", () => {
        const store = new DoctorStore(sample());

        store.setFilter("ALPHA");

        expect(store.getSnapshot().entries.map((f) => f.title)).toEqual(["alpha"]);
    });

    it("combines section filter and text filter", () => {
        const store = new DoctorStore(sample());

        store.setFilterType("dependencies");
        store.setFilter("br");

        expect(store.getSnapshot().entries.map((f) => f.title)).toEqual(["bravo"]);
    });

    it("clears the text on filter close", () => {
        const store = new DoctorStore(sample());

        store.setFilterActive(true);
        store.setFilter("alpha");
        store.setFilterActive(false);

        const state = store.getSnapshot();

        expect(state.filterActive).toBe(false);
        expect(state.filterText).toBe("");
        expect(state.entries.map((f) => f.title)).toEqual(["alpha", "bravo"]);
    });

    it("clamps selectedIndex to entries length", () => {
        const store = new DoctorStore(sample());

        store.setSelectedIndex(99);

        expect(store.getSnapshot().selectedIndex).toBe(1);

        store.setSelectedIndex(-5);

        expect(store.getSnapshot().selectedIndex).toBe(0);
    });

    it("toggles focused panel", () => {
        const store = new DoctorStore(sample());

        store.setFocusedPanel("detail");

        expect(store.getSnapshot().focusedPanel).toBe("detail");

        store.setFocusedPanel("list");

        expect(store.getSnapshot().focusedPanel).toBe("list");
    });

    it("notifies subscribers on state change", () => {
        const store = new DoctorStore(sample());
        let calls = 0;
        const unsubscribe = store.subscribe(() => {
            calls += 1;
        });

        store.setSelectedIndex(1);
        store.setFilterType("security");
        unsubscribe();
        store.setSelectedIndex(0);

        expect(calls).toBe(2);
    });

    it("does not emit when state would not change", () => {
        const store = new DoctorStore(sample());
        let calls = 0;

        store.subscribe(() => {
            calls += 1;
        });

        store.setFilterType("dependencies");
        store.setFocusedPanel("list");
        store.setFilterActive(false);

        expect(calls).toBe(0);
    });

    it("starts empty in streaming mode and tracks per-section status", () => {
        const store = new DoctorStore({});
        const initial = store.getSnapshot();

        expect(initial.all).toHaveLength(0);
        expect(initial.sectionStatus.dependencies).toBe("idle");
        expect(initial.sectionStatus.security).toBe("idle");
    });

    it("startSection flips status to running and stores message", () => {
        const store = new DoctorStore({});

        store.startSection("dependencies", "scanning catalog");

        const state = store.getSnapshot();

        expect(state.sectionStatus.dependencies).toBe("running");
        expect(state.sectionMessage.dependencies).toBe("scanning catalog");
    });

    it("completeSection appends findings, regroups, and clears message", () => {
        const store = new DoctorStore({});

        store.startSection("dependencies", "loading");
        store.completeSection("dependencies", [
            make("dependencies", "alpha", "warn"),
            make("dependencies", "bravo"),
        ]);

        const state = store.getSnapshot();

        expect(state.sectionStatus.dependencies).toBe("done");
        expect(state.sectionMessage.dependencies).toBeUndefined();
        expect(state.entries.map((f) => f.title)).toEqual(["alpha", "bravo"]);
        expect(state.grouped.get("dependencies")).toHaveLength(2);
    });

    it("completeSection layers — security findings appear after deps", () => {
        const store = new DoctorStore({});

        store.completeSection("dependencies", [make("dependencies", "alpha", "warn")]);
        store.completeSection("security", [make("security", "charlie", "error")]);

        expect(store.getSnapshot().all.map((f) => f.title)).toEqual(["alpha", "charlie"]);

        store.setFilterType("security");

        expect(store.getSnapshot().entries.map((f) => f.title)).toEqual(["charlie"]);
    });

    it("failSection records error and flips status without dropping prior data", () => {
        const store = new DoctorStore({});

        store.completeSection("dependencies", [make("dependencies", "alpha", "warn")]);
        store.failSection("security", "registry timeout");

        const state = store.getSnapshot();

        expect(state.sectionStatus.security).toBe("error");
        expect(state.sectionError.security).toBe("registry timeout");
        expect(state.all).toHaveLength(1);
    });

    it("setSeverityFilter narrows entries to a single severity", () => {
        const store = new DoctorStore(sample());

        store.setFilterType("security");
        store.setSeverityFilter("error");

        const state = store.getSnapshot();

        expect(state.severityFilter).toBe("error");
        expect(state.entries.map((f) => f.title)).toEqual(["charlie"]);
        expect(state.selectedIndex).toBe(0);
    });

    it("setSeverityFilter clears when set back to undefined", () => {
        const store = new DoctorStore(sample());

        store.setFilterType("security");
        store.setSeverityFilter("error");
        store.setSeverityFilter(undefined);

        const state = store.getSnapshot();

        expect(state.severityFilter).toBeUndefined();
        expect(state.entries.map((f) => f.title)).toEqual(["charlie"]);
    });

    it("setPendingAction stores and clears the action", () => {
        const store = new DoctorStore({});

        store.setPendingAction({ command: "vis update lodash", description: "Update lodash" });

        expect(store.getSnapshot().pendingAction).toEqual({ command: "vis update lodash", description: "Update lodash" });

        store.setPendingAction(undefined);

        expect(store.getSnapshot().pendingAction).toBeUndefined();
    });

    it("severity filter combines with section + text filters", () => {
        const store = new DoctorStore(sample());

        store.setFilterType("security");
        store.setSeverityFilter("error");

        expect(store.getSnapshot().entries.map((f) => f.title)).toEqual(["charlie"]);

        store.setSeverityFilter("warn");

        expect(store.getSnapshot().entries).toHaveLength(0);
    });
});
