/** An optimization entry that can be either an e18e module replacement or a Socket.dev override. */
interface OptimizeEntry {
    /** Category for filtering and display. */
    category: "micro-utility" | "native" | "preferred" | "socket";
    /** Upstream e18e migration guide URL when the manifest variant is `documented`. */
    docUrl?: string;
    /** Whether a codemod is available for this entry (e18e only). */
    hasCodemod: boolean;
    /** The override spec for socket entries (e.g., "npm:@socketregistry/is-regex@^1"). */
    overrideSpec?: string;
    /** The original package name. */
    packageName: string;
    /** Human-readable replacement target description. */
    replacement: string;
}

type FilterType = "all" | "micro-utility" | "native" | "preferred" | "socket";

interface OptimizeState {
    applyProgress: { current: number; total: number } | null;
    checkedEntries: Set<string>;
    entries: OptimizeEntry[];
    error: string | null;
    filterActive: boolean;
    filterText: string;
    filterType: FilterType;
    focusedPanel: "detail" | "list";
    phase: "applying" | "browsing" | "done" | "error";
    selectedIndex: number;
}

type Listener = () => void;

const filterEntries = (entries: OptimizeEntry[], filterType: FilterType, filterText: string): OptimizeEntry[] => {
    let filtered = entries;

    if (filterType !== "all") {
        filtered = filtered.filter((e) => e.category === filterType);
    }

    if (filterText) {
        const lower = filterText.toLowerCase();

        filtered = filtered.filter((e) => e.packageName.toLowerCase().includes(lower));
    }

    return filtered;
};

class OptimizeStore {
    #state: OptimizeState;

    #listeners = new Set<Listener>();

    constructor(entries: OptimizeEntry[]) {
        this.#state = {
            applyProgress: null,
            checkedEntries: new Set<string>(),
            entries,
            error: null,
            filterActive: false,
            filterText: "",
            filterType: "all",
            focusedPanel: "list",
            phase: "browsing",
            selectedIndex: 0,
        };
    }

    getSnapshot = (): OptimizeState => this.#state;

    subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    getFilteredEntries = (): OptimizeEntry[] => filterEntries(this.#state.entries, this.#state.filterType, this.#state.filterText);

    #notify(): void {
        this.#state = { ...this.#state };

        for (const listener of this.#listeners) {
            listener();
        }
    }

    select(index: number): void {
        const filtered = this.getFilteredEntries();

        this.#state.selectedIndex = filtered.length === 0 ? -1 : Math.max(0, Math.min(index, filtered.length - 1));
        this.#notify();
    }

    toggleCheck(packageName: string): void {
        const checked = new Set(this.#state.checkedEntries);

        if (checked.has(packageName)) {
            checked.delete(packageName);
        } else {
            checked.add(packageName);
        }

        this.#state.checkedEntries = checked;
        this.#notify();
    }

    toggleAll(): void {
        const filtered = this.getFilteredEntries();
        const checked = new Set(this.#state.checkedEntries);
        const allChecked = filtered.every((e) => checked.has(e.packageName));

        if (allChecked) {
            for (const e of filtered) {
                checked.delete(e.packageName);
            }
        } else {
            for (const e of filtered) {
                checked.add(e.packageName);
            }
        }

        this.#state.checkedEntries = checked;
        this.#notify();
    }

    setFilter(type: FilterType): void {
        this.#state.filterType = type;
        this.#state.selectedIndex = 0;
        this.#notify();
    }

    setFilterText(text: string): void {
        this.#state.filterText = text;
        this.#state.selectedIndex = 0;
        this.#notify();
    }

    setFilterActive(active: boolean): void {
        this.#state.filterActive = active;
        this.#notify();
    }

    setFocusedPanel(panel: "detail" | "list"): void {
        this.#state.focusedPanel = panel;
        this.#notify();
    }

    setPhase(phase: OptimizeState["phase"]): void {
        this.#state.phase = phase;
        this.#notify();
    }

    setProgress(current: number, total: number): void {
        this.#state.applyProgress = { current, total };
        this.#notify();
    }

    setError(error: string): void {
        this.#state.error = error;
        this.#state.phase = "error";
        this.#notify();
    }

    getCheckedEntries(): OptimizeEntry[] {
        return this.#state.entries.filter((e) => this.#state.checkedEntries.has(e.packageName));
    }
}

export type { FilterType, OptimizeEntry, OptimizeState };
export { OptimizeStore };
