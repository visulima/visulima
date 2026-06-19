import type { AiAnalysisResult, AiRecommendation } from "../../../ai/ai-analysis";
import type { EcosystemUpdate } from "../../../commands/update/ecosystems";
import type { OutdatedEntry } from "../../../util/catalog";

export type FilterType = "all" | "major" | "minor" | "patch" | "security";
export type UpdatePhase = "applying" | "browsing" | "done" | "error";

/**
 * Sort order for the visible entry list. `default` is whatever order the
 * caller passed in (catalog grouping); the others cycle via `s` so users
 * can quickly re-stack the list by what matters to them right now.
 */
export type SortMode = "default" | "name" | "severity" | "updateType";

const SORT_CYCLE: ReadonlyArray<SortMode> = ["default", "name", "updateType", "severity"];

/** Stable severity rank — higher comes first when sorting by severity. */
const severityRank = (entry: OutdatedEntry): number => {
    const vulnSeverities = entry.vulnerabilities?.map((vulnerability) => vulnerability.severity) ?? [];

    if (vulnSeverities.includes("CRITICAL")) {
        return 4;
    }

    if (vulnSeverities.includes("HIGH")) {
        return 3;
    }

    if (vulnSeverities.includes("MODERATE")) {
        return 2;
    }

    if (vulnSeverities.includes("LOW")) {
        return 1;
    }

    return 0;
};

const UPDATE_TYPE_RANK: Record<string, number> = { digest: 0, major: 3, minor: 2, patch: 1, pin: 0, unknown: 0 };

const sortEntries = (entries: OutdatedEntry[], mode: SortMode): OutdatedEntry[] => {
    if (mode === "default") {
        return entries;
    }

    const copy = [...entries];

    if (mode === "name") {
        copy.sort((a, b) => a.packageName.localeCompare(b.packageName));
    } else if (mode === "updateType") {
        copy.sort((a, b) => (UPDATE_TYPE_RANK[b.updateType] ?? 0) - (UPDATE_TYPE_RANK[a.updateType] ?? 0) || a.packageName.localeCompare(b.packageName));
    } else {
        copy.sort((a, b) => severityRank(b) - severityRank(a) || a.packageName.localeCompare(b.packageName));
    }

    return copy;
};

/**
 * Stable per-entry key used to track check state for ecosystem updates.
 * Mirrors the (file, line) anchor the applier rewrites by and the
 * display name the user sees in the picker.
 */
export const ecosystemEntryKey = (entry: EcosystemUpdate): string => `${entry.ecosystem}|${entry.file}:${String(entry.line)}|${entry.name}`;

/**
 * Stable, collision-free identity for a catalog entry. Keying the check-set on
 * `packageName` alone conflated one package pinned at different versions across
 * catalogs (for instance `nodemailer` in both the `dev` and `prod` catalogs),
 * so toggling one row toggled both. Combining `catalogName` with the package
 * name keeps each catalog's row independently selectable. A tab cannot appear
 * in a catalog or package name, so it is a safe separator.
 */
export const entryKey = (entry: OutdatedEntry): string => `${entry.catalogName}\t${entry.packageName}`;

export interface UpdateState {
    /** AI analysis result (null if not requested). */
    aiResult: AiAnalysisResult | null;
    /** Whether all visible entries are checked. */
    allChecked: boolean;
    /** Progress during apply phase. */
    applyProgress: { current: number; total: number } | null;
    /** Set of `ecosystemEntryKey()`s the user has checked for apply. */
    checkedEcosystemKeys: Set<string>;
    /** Set of checked package names for selective apply. */
    checkedEntries: Set<string>;

    /**
     * Non-npm ecosystem entries (GitHub Actions, Docker, GitLab CI).
     * Plumbed through the store + accessible via `getCheckedEcosystemEntries()`,
     * but the picker UI is npm-only today — a future `--ecosystem` view in
     * `vis-update-app.tsx` will render these.
     */
    ecosystemEntries: EcosystemUpdate[];
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
    /** Currently active sort mode for the list panel. */
    sortMode: SortMode;
}

type Listener = () => void;

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
        filtered
            = filterType === "security"
                ? filtered.filter((e) => (e.vulnerabilities && e.vulnerabilities.length > 0) || (e.socketReport && e.socketReport.alerts.length > 0))
                : filtered.filter((e) => e.updateType === filterType);
    }

    if (filterText) {
        const lower = filterText.toLowerCase();

        filtered = filtered.filter((e) => e.packageName.toLowerCase().includes(lower));
    }

    return filtered;
};

export class UpdateStore {
    #state: UpdateState;

    #listeners = new Set<Listener>();

    #allEntries: OutdatedEntry[];

    #allEcosystemEntries: EcosystemUpdate[];

    #recommendationMap: Map<string, AiRecommendation> | null = null;

    public constructor(entries: OutdatedEntry[], aiResult: AiAnalysisResult | null = null, ecosystemEntries: EcosystemUpdate[] = []) {
        this.#allEntries = entries;
        this.#allEcosystemEntries = ecosystemEntries;

        if (aiResult) {
            this.#recommendationMap = new Map(aiResult.recommendations.map((r) => [r.package, r]));
        }

        this.#state = {
            aiResult,
            allChecked: true,
            applyProgress: null,
            checkedEcosystemKeys: new Set(ecosystemEntries.map((entry) => ecosystemEntryKey(entry))),
            checkedEntries: new Set(entries.map((e) => entryKey(e))),
            ecosystemEntries,
            entries,
            error: null,
            filterActive: false,
            filterText: "",
            filterType: "all",
            focusedPanel: "list",
            groupedByCatalog: groupByCatalog(entries),
            phase: "browsing",
            selectedIndex: 0,
            sortMode: "default",
        };
    }

    public getSnapshot = (): UpdateState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    /** Get the currently filtered + visible entries. */
    public getFilteredEntries(): OutdatedEntry[] {
        return sortEntries(filterEntries(this.#allEntries, this.#state.filterType, this.#state.filterText), this.#state.sortMode);
    }

    public setSortMode(mode: SortMode): void {
        if (mode === this.#state.sortMode) {
            return;
        }

        // Pin the highlight to the previously-selected package across the
        // re-sort so the user doesn't lose their place. Falls back to 0
        // when the prior selection has been filtered out.
        const previousVisible = this.getFilteredEntries();
        const previousSelected = previousVisible[this.#state.selectedIndex]?.packageName;

        const nextVisible = sortEntries(filterEntries(this.#allEntries, this.#state.filterType, this.#state.filterText), mode);
        const nextIndex = previousSelected
            ? Math.max(
                0,
                nextVisible.findIndex((entry) => entry.packageName === previousSelected),
            )
            : 0;

        this.#emit({ ...this.#state, selectedIndex: nextIndex, sortMode: mode });
    }

    /**
     * Cycle through the sort modes — bound to `s` in the TUI. The
     * highlighted package is preserved across the re-sort (see
     * `setSortMode`) so the user doesn't lose their place.
     */
    public cycleSortMode(): void {
        const currentIndex = SORT_CYCLE.indexOf(this.#state.sortMode);
        const nextMode = SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length] ?? "default";

        this.setSortMode(nextMode);
    }

    /** Get AI recommendation for a specific package. */
    public getRecommendation(packageName: string): AiRecommendation | undefined {
        return this.#recommendationMap?.get(packageName);
    }

    /** Get the list of checked entries (for apply). */
    public getCheckedEntries(): OutdatedEntry[] {
        return this.#allEntries.filter((e) => this.#state.checkedEntries.has(entryKey(e)));
    }

    /** Get the list of checked ecosystem entries (for apply). */
    public getCheckedEcosystemEntries(): EcosystemUpdate[] {
        return this.#allEcosystemEntries.filter((entry) => this.#state.checkedEcosystemKeys.has(ecosystemEntryKey(entry)));
    }

    public toggleEcosystemCheck(key: string): void {
        const next = new Set(this.#state.checkedEcosystemKeys);

        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }

        this.#emit({ ...this.#state, checkedEcosystemKeys: next });
    }

    public checkAllEcosystem(): void {
        this.#emit({
            ...this.#state,
            checkedEcosystemKeys: new Set(this.#allEcosystemEntries.map((entry) => ecosystemEntryKey(entry))),
        });
    }

    public uncheckAllEcosystem(): void {
        this.#emit({ ...this.#state, checkedEcosystemKeys: new Set() });
    }

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

    /**
     * Toggle a single entry's checked state. Keyed by {@link entryKey} (not the
     * bare package name) so the same package pinned at different versions in
     * different catalogs toggles independently.
     */
    public toggleCheck(entry: OutdatedEntry): void {
        const key = entryKey(entry);
        const checked = new Set(this.#state.checkedEntries);

        if (checked.has(key)) {
            checked.delete(key);
        } else {
            checked.add(key);
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
            checkedEntries: new Set(this.#allEntries.map((e) => entryKey(e))),
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
