/** Per-key change captured by diffing original vs sorted top-level keys. */
interface SortKeyDiff {
    fromIndex: number;
    key: string;
    toIndex: number;
}

/** Source-position context for a JSON parse error. */
interface SortErrorContext {
    column: number;
    line: number;

    /**
     * Lines around the error position with the error line flagged. Stored
     * as objects rather than a pre-formatted string so the panel can
     * render line numbers and highlighting.
     */
    snippet: { content: string; isErrorLine: boolean; lineNumber: number }[];
}

/** Which step of `processFile` failed. */
type SortErrorStep = "json-parse" | "native-sort" | "read" | "write";

interface SortError {
    context?: SortErrorContext;
    message: string;
    step: SortErrorStep;
}

type SortFileStatus = "error" | "rewritten" | "unchanged" | "would-rewrite";

/**
 * Outcome of running the sort pipeline against a single package.json.
 * `would-rewrite` is the `--check` analogue of `rewritten` — same diff,
 * just no write happened.
 */
interface SortFileEntry {
    diff: SortKeyDiff[];
    error?: SortError;
    filePath: string;
    /** Workspace-relative path for display. Defaults to absolute when no root supplied. */
    relativePath: string;
    status: SortFileStatus;
}

type FilterType = "all" | "errors" | "rewritten" | "unchanged";

interface SortState {
    entries: SortFileEntry[];
    filterType: FilterType;
    focusedPanel: "detail" | "list";
    selectedIndex: number;
}

type Listener = () => void;

// Severity-first ordering: errors before rewrites before clean files. The
// store applies this once on construction so every consumer (panel, header,
// initial selection) sees the same order.
/* eslint-disable perfectionist/sort-objects -- ordering is the value here, not alphabetization */
const STATUS_RANK: Record<SortFileStatus, number> = {
    error: 0,
    rewritten: 1,
    "would-rewrite": 1,
    unchanged: 2,
};
/* eslint-enable perfectionist/sort-objects */

const sortByStatusRank = (entries: SortFileEntry[]): SortFileEntry[] =>
    [...entries].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

const filterEntries = (entries: SortFileEntry[], filterType: FilterType): SortFileEntry[] => {
    if (filterType === "all") {
        return entries;
    }

    if (filterType === "errors") {
        return entries.filter((e) => e.status === "error");
    }

    if (filterType === "rewritten") {
        return entries.filter((e) => e.status === "rewritten" || e.status === "would-rewrite");
    }

    return entries.filter((e) => e.status === "unchanged");
};

class SortPackageJsonStore {
    #state: SortState;

    #listeners = new Set<Listener>();

    constructor(entries: SortFileEntry[]) {
        // Errors first means selectedIndex 0 is always the most actionable
        // entry, so no special-case for the initial selection.
        this.#state = {
            entries: sortByStatusRank(entries),
            filterType: "all",
            focusedPanel: "list",
            selectedIndex: 0,
        };
    }

    getSnapshot = (): SortState => this.#state;

    subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    getFilteredEntries = (): SortFileEntry[] => filterEntries(this.#state.entries, this.#state.filterType);

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

    // Step relative to the *current* selectedIndex, not a captured-closure
    // value. Critical when input events arrive faster than React can
    // re-render — e.g. one mouse-wheel notch is often 3+ arrow events sent
    // back-to-back, which would otherwise collapse to a single step.
    selectStep(delta: number): void {
        this.select(this.#state.selectedIndex + delta);
    }

    setFilter(type: FilterType): void {
        this.#state.filterType = type;
        this.#state.selectedIndex = 0;
        this.#notify();
    }

    setFocusedPanel(panel: "detail" | "list"): void {
        this.#state.focusedPanel = panel;
        this.#notify();
    }
}

export type { FilterType, SortError, SortErrorContext, SortErrorStep, SortFileEntry, SortFileStatus, SortKeyDiff, SortState };
export { SortPackageJsonStore };
