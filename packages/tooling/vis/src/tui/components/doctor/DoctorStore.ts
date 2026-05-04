import type { SectionId } from "../../../commands/doctor/sections";
import type { DoctorFinding, FindingSeverity } from "./findings";

/**
 * Tab filter for the list pane. One tab per scan section — users
 * focus on a single concern at a time.
 */
export type FilterType = SectionId;

/**
 * Single source of truth for the filter tab order + labels. Both the
 * list panel (renders tabs) and the orchestrator (left/right cycling)
 * consume this so adding a section is a one-line change.
 */
export const FILTER_TABS: ReadonlyArray<{ id: FilterType; label: string }> = [
    { id: "dependencies", label: "Deps" },
    { id: "security", label: "Security" },
    { id: "optimization", label: "Optimize" },
    { id: "runtime", label: "Runtime" },
];

/**
 * Lifecycle of a doctor scan section. Tabs render a spinner while
 * `running`, the count when `done`, and an error glyph on `error`.
 * `idle` only appears for sections excluded by --skip / --only flags.
 */
export type SectionStatus = "done" | "error" | "idle" | "running";

/**
 * Action keybinds (u/o/a) record a pending action on exit. The handler
 * reads it after the TUI unmounts and prints the suggested next command
 * — kept lightweight rather than mutating the workspace from inside the
 * TUI.
 */
export interface PendingAction {
    /** Shell command we'd suggest running next. */
    readonly command: string;
    /** Optional config snippet (e.g. ack JSON) to print verbatim. */
    readonly configSnippet?: string;
    /** Short human description (e.g. "Update lodash"). */
    readonly description: string;
}

export interface DoctorState {
    /** All findings collected so far, including in-progress sections. */
    readonly all: ReadonlyArray<DoctorFinding>;
    /** Findings after filterType + filterText are applied. */
    readonly entries: ReadonlyArray<DoctorFinding>;
    /** Whether the text-filter input is in capture mode. */
    readonly filterActive: boolean;
    /** Free-text filter on title (case-insensitive). */
    readonly filterText: string;
    /** Section filter tab. */
    readonly filterType: FilterType;
    /** Which pane has keyboard focus. */
    readonly focusedPanel: "detail" | "list";
    /** Findings grouped by section, in declaration order. */
    readonly grouped: ReadonlyMap<SectionId, ReadonlyArray<DoctorFinding>>;
    /** Pending exit action recorded by an action keybind (u/o/a). */
    readonly pendingAction: PendingAction | undefined;
    /** Per-section error message — only set when status is `error`. */
    readonly sectionError: Readonly<Partial<Record<SectionId, string>>>;
    /** Per-section progress message — short status text shown next to the tab. */
    readonly sectionMessage: Readonly<Partial<Record<SectionId, string>>>;
    /** Per-section lifecycle status. */
    readonly sectionStatus: Readonly<Record<SectionId, SectionStatus>>;
    /** Index into `entries`. */
    readonly selectedIndex: number;
    /** Optional severity filter — `undefined` shows all severities. */
    readonly severityFilter: FindingSeverity | undefined;
}

type Listener = () => void;

const SECTION_ORDER: SectionId[] = ["dependencies", "security", "optimization", "runtime"];

const groupBySection = (findings: ReadonlyArray<DoctorFinding>): Map<SectionId, DoctorFinding[]> => {
    const map = new Map<SectionId, DoctorFinding[]>();

    for (const section of SECTION_ORDER) {
        map.set(section, []);
    }

    for (const finding of findings) {
        map.get(finding.section)!.push(finding);
    }

    // Drop empty sections so the list pane doesn't render headers
    // for scans that came back clean.
    for (const [section, items] of map) {
        if (items.length === 0) {
            map.delete(section);
        }
    }

    return map;
};

const filterFindings = (
    findings: ReadonlyArray<DoctorFinding>,
    filterType: FilterType,
    filterText: string,
    severityFilter: FindingSeverity | undefined,
): DoctorFinding[] => {
    let filtered: ReadonlyArray<DoctorFinding> = findings.filter((f) => f.section === filterType);

    if (severityFilter) {
        filtered = filtered.filter((f) => f.severity === severityFilter);
    }

    if (filterText) {
        const lower = filterText.toLowerCase();

        filtered = filtered.filter((f) => f.title.toLowerCase().includes(lower));
    }

    return [...filtered];
};

const initialStatus = (activeSections: ReadonlySet<SectionId>): Record<SectionId, SectionStatus> => {
    const status: Record<SectionId, SectionStatus> = {
        dependencies: "idle",
        optimization: "idle",
        runtime: "idle",
        security: "idle",
    };

    for (const id of SECTION_ORDER) {
        if (activeSections.has(id)) {
            status[id] = "idle";
        }
    }

    return status;
};

interface DoctorStoreOptions {
    /** Sections that will run during this doctor session. */
    readonly activeSections?: ReadonlySet<SectionId>;
    /** Pre-existing findings to seed (used by tests + non-streaming path). */
    readonly findings?: ReadonlyArray<DoctorFinding>;
}

/**
 * External state container for the doctor TUI. Findings stream in as
 * scans complete; the store recomputes derived views (entries/grouped)
 * after each section update.
 */
export class DoctorStore {
    #state: DoctorState;

    #listeners = new Set<Listener>();

    public constructor(input: ReadonlyArray<DoctorFinding> | DoctorStoreOptions = []) {
        const options: DoctorStoreOptions = Array.isArray(input) ? { findings: input as ReadonlyArray<DoctorFinding> } : (input as DoctorStoreOptions);
        const findings = options.findings ?? [];
        const activeSections = options.activeSections ?? new Set<SectionId>(SECTION_ORDER);
        const initialFilter: FilterType = SECTION_ORDER.find((id) => activeSections.has(id)) ?? "dependencies";

        const seed = filterFindings(findings, initialFilter, "", undefined);
        const status = initialStatus(activeSections);

        // Pre-seeded findings imply those sections completed before the
        // store was constructed (used by the non-streaming test path).
        if (findings.length > 0) {
            for (const finding of findings) {
                status[finding.section] = "done";
            }
        }

        this.#state = {
            all: findings,
            entries: seed,
            filterActive: false,
            filterText: "",
            filterType: initialFilter,
            focusedPanel: "list",
            grouped: groupBySection(seed),
            pendingAction: undefined,
            sectionError: {},
            sectionMessage: {},
            sectionStatus: status,
            selectedIndex: 0,
            severityFilter: undefined,
        };
    }

    public getSnapshot = (): DoctorState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    public setSelectedIndex(index: number): void {
        const clamped = Math.max(0, Math.min(index, this.#state.entries.length - 1));

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
        if (type === this.#state.filterType) {
            return;
        }

        const newEntries = filterFindings(this.#state.all, type, this.#state.filterText, this.#state.severityFilter);

        this.#emit({
            ...this.#state,
            entries: newEntries,
            filterType: type,
            grouped: groupBySection(newEntries),
            selectedIndex: 0,
        });
    }

    public setFilter(text: string): void {
        const newEntries = filterFindings(this.#state.all, this.#state.filterType, text, this.#state.severityFilter);

        this.#emit({
            ...this.#state,
            entries: newEntries,
            filterText: text,
            grouped: groupBySection(newEntries),
            selectedIndex: 0,
        });
    }

    public setFilterActive(active: boolean): void {
        if (active === this.#state.filterActive) {
            return;
        }

        if (active) {
            this.#emit({ ...this.#state, filterActive: true });

            return;
        }

        // Closing the filter clears the text so the list snaps back
        // to the full set — same shape as UpdateStore.
        const newEntries = filterFindings(this.#state.all, this.#state.filterType, "", this.#state.severityFilter);

        this.#emit({
            ...this.#state,
            entries: newEntries,
            filterActive: false,
            filterText: "",
            grouped: groupBySection(newEntries),
            selectedIndex: 0,
        });
    }

    public setPendingAction(action: PendingAction | undefined): void {
        this.#emit({ ...this.#state, pendingAction: action });
    }

    public setSeverityFilter(severity: FindingSeverity | undefined): void {
        if (severity === this.#state.severityFilter) {
            return;
        }

        const newEntries = filterFindings(this.#state.all, this.#state.filterType, this.#state.filterText, severity);

        this.#emit({
            ...this.#state,
            entries: newEntries,
            grouped: groupBySection(newEntries),
            selectedIndex: 0,
            severityFilter: severity,
        });
    }

    public startSection(section: SectionId, message?: string): void {
        this.#emit({
            ...this.#state,
            sectionMessage: { ...this.#state.sectionMessage, [section]: message },
            sectionStatus: { ...this.#state.sectionStatus, [section]: "running" },
        });
    }

    public completeSection(section: SectionId, findings: ReadonlyArray<DoctorFinding>): void {
        const newAll = [...this.#state.all, ...findings];
        const newEntries = filterFindings(newAll, this.#state.filterType, this.#state.filterText, this.#state.severityFilter);
        const nextMessage = { ...this.#state.sectionMessage };

        delete nextMessage[section];

        this.#emit({
            ...this.#state,
            all: newAll,
            entries: newEntries,
            grouped: groupBySection(newEntries),
            sectionMessage: nextMessage,
            sectionStatus: { ...this.#state.sectionStatus, [section]: "done" },
        });
    }

    public failSection(section: SectionId, error: string): void {
        this.#emit({
            ...this.#state,
            sectionError: { ...this.#state.sectionError, [section]: error },
            sectionStatus: { ...this.#state.sectionStatus, [section]: "error" },
        });
    }

    #emit(newState: DoctorState): void {
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
