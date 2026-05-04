import type { AiAnalysisResult, AiRecommendation } from "../../../ai/ai-analysis";
import type { OutdatedEntry } from "../../../util/catalog";

// ── State Shape ─────────────────────────────────────────────────────────

export type FilterType = "all" | "major" | "minor" | "patch" | "security";
export type UpdatePhase = "applying" | "browsing" | "done" | "error";

export interface UpdateState {
    /** AI analysis result (null if not requested). */
    aiResult: AiAnalysisResult | null;
    /** Whether all visible entries are checked. */
    allChecked: boolean;
    /** Progress during apply phase. */
    applyProgress: { current: number; total: number } | null;
    /** Set of checked package names for selective apply. */
    checkedEntries: Set<string>;
    /** All outdated entries. */
    entries: OutdatedEntry[];
    /** Error message if apply failed. */
    error: string | null;
    /** Whether the text filter input is active. */
    filterActive: boolean;
    /** Current filter text (empty = no filter). */
    filterText: string;
    /** Filter by update type. */
    filterType: FilterType;
    /** Which panel has keyboard focus. */
    focusedPanel: "detail" | "list";
    /** Entries grouped by catalog name. */
    groupedByCatalog: Map<string, OutdatedEntry[]>;
    /** Current lifecycle phase. */
    phase: UpdatePhase;
    /** Currently highlighted entry index in the filtered list. */
    selectedIndex: number;
}

type Listener = () => void;

// ── Helpers ─────────────────────────────────────────────────────────────

const groupByCatalog = (entries: OutdatedEntry[]): Map<string, OutdatedEntry[]> => {
    const map = new Map<string, OutdatedEntry[]>();

    for (const entry of entries) {
        const group = map.get(entry.catalogName);

        if (group) {
            group.push(entry);
        } else {
            map.set(entry.catalogName, [entry]);
        }
    }

    return map;
};

const filterEntries = (entries: OutdatedEntry[], filterType: FilterType, filterText: string): OutdatedEntry[] => {
    let filtered = entries;

    if (filterType !== "all") {
        filtered =
            filterType === "security"
                ? filtered.filter((e) => (e.vulnerabilities && e.vulnerabilities.length > 0) || (e.socketReport && e.socketReport.alerts.length > 0))
                : filtered.filter((e) => e.updateType === filterType);
    }

    if (filterText) {
        const lower = filterText.toLowerCase();

        filtered = filtered.filter((e) => e.packageName.toLowerCase().includes(lower));
    }

    return filtered;
};

// ── UpdateStore ─────────────────────────────────────────────────────────

export class UpdateStore {
    #state: UpdateState;

    #listeners = new Set<Listener>();

    #allEntries: OutdatedEntry[];

    #recommendationMap: Map<string, AiRecommendation> | null = null;

    public constructor(entries: OutdatedEntry[], aiResult: AiAnalysisResult | null = null) {
        this.#allEntries = entries;

        if (aiResult) {
            this.#recommendationMap = new Map(aiResult.recommendations.map((r) => [r.package, r]));
        }

        this.#state = {
            aiResult,
            allChecked: true,
            applyProgress: null,
            checkedEntries: new Set(entries.map((e) => e.packageName)),
            entries,
            error: null,
            filterActive: false,
            filterText: "",
            filterType: "all",
            focusedPanel: "list",
            groupedByCatalog: groupByCatalog(entries),
            phase: "browsing",
            selectedIndex: 0,
        };
    }

    // ── React integration ───────────────────────────────────────────

    public getSnapshot = (): UpdateState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    // ── Derived data ────────────────────────────────────────────────

    /** Get the currently filtered + visible entries. */
    public getFilteredEntries(): OutdatedEntry[] {
        return filterEntries(this.#allEntries, this.#state.filterType, this.#state.filterText);
    }

    /** Get AI recommendation for a specific package. */
    public getRecommendation(packageName: string): AiRecommendation | undefined {
        return this.#recommendationMap?.get(packageName);
    }

    /** Get the list of checked entries (for apply). */
    public getCheckedEntries(): OutdatedEntry[] {
        return this.#allEntries.filter((e) => this.#state.checkedEntries.has(e.packageName));
    }

    // ── Navigation ──────────────────────────────────────────────────

    public setSelectedIndex(index: number): void {
        const filtered = this.getFilteredEntries();
        const clamped = Math.max(0, Math.min(index, filtered.length - 1));

        if (clamped !== this.#state.selectedIndex) {
            this.#emit({ ...this.#state, selectedIndex: clamped });
        }
    }

    public setFocusedPanel(panel: "detail" | "list"): void {
        if (panel !== this.#state.focusedPanel) {
            this.#emit({ ...this.#state, focusedPanel: panel });
        }
    }

    // ── Filtering ───────────────────────────────────────────────────

    public setFilterType(type: FilterType): void {
        if (type !== this.#state.filterType) {
            const newEntries = filterEntries(this.#allEntries, type, this.#state.filterText);

            this.#emit({
                ...this.#state,
                entries: newEntries,
                filterType: type,
                groupedByCatalog: groupByCatalog(newEntries),
                selectedIndex: 0,
            });
        }
    }

    public setFilter(text: string): void {
        const newEntries = filterEntries(this.#allEntries, this.#state.filterType, text);

        this.#emit({
            ...this.#state,
            entries: newEntries,
            filterText: text,
            groupedByCatalog: groupByCatalog(newEntries),
            selectedIndex: 0,
        });
    }

    public setFilterActive(active: boolean): void {
        if (active !== this.#state.filterActive) {
            if (active) {
                this.#emit({ ...this.#state, filterActive: true });
            } else {
                const newEntries = filterEntries(this.#allEntries, this.#state.filterType, "");

                this.#emit({
                    ...this.#state,
                    entries: newEntries,
                    filterActive: false,
                    filterText: "",
                    groupedByCatalog: groupByCatalog(newEntries),
                    selectedIndex: 0,
                });
            }
        }
    }

    // ── Selection ───────────────────────────────────────────────────

    public toggleCheck(packageName: string): void {
        const checked = new Set(this.#state.checkedEntries);

        if (checked.has(packageName)) {
            checked.delete(packageName);
        } else {
            checked.add(packageName);
        }

        this.#emit({
            ...this.#state,
            allChecked: checked.size === this.#allEntries.length,
            checkedEntries: checked,
        });
    }

    public checkAll(): void {
        this.#emit({
            ...this.#state,
            allChecked: true,
            checkedEntries: new Set(this.#allEntries.map((e) => e.packageName)),
        });
    }

    public uncheckAll(): void {
        this.#emit({
            ...this.#state,
            allChecked: false,
            checkedEntries: new Set(),
        });
    }

    public toggleAll(): void {
        if (this.#state.allChecked) {
            this.uncheckAll();
        } else {
            this.checkAll();
        }
    }

    // ── Apply lifecycle ─────────────────────────────────────────────

    public startApply(): void {
        const checked = this.getCheckedEntries();

        this.#emit({
            ...this.#state,
            applyProgress: { current: 0, total: checked.length },
            phase: "applying",
        });
    }

    public updateApplyProgress(current: number): void {
        if (this.#state.applyProgress) {
            this.#emit({
                ...this.#state,
                applyProgress: { ...this.#state.applyProgress, current },
            });
        }
    }

    public markDone(): void {
        this.#emit({ ...this.#state, phase: "done" });
    }

    public setError(error: string): void {
        this.#emit({ ...this.#state, error, phase: "error" });
    }

    // ── Internal ────────────────────────────────────────────────────

    #emit(newState: UpdateState): void {
        this.#state = newState;

        for (const listener of this.#listeners) {
            try {
                listener();
            } catch {
                // Isolate listener errors
            }
        }
    }
}
