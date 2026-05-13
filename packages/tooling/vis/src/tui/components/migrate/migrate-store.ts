import type { MigrationEntry } from "../../../commands/migrate/registry";

export type MigratePhase = "applying" | "browsing" | "done" | "error";

export interface MigrateItem {
    entry: MigrationEntry;
    preview: string[];
}

export interface MigrateState {
    /** Progress during apply phase. */
    applyProgress: { current: number; total: number } | null;
    /** Set of checked migration ids (for selective apply). */
    checkedItems: Set<string>;
    /** Error message if apply failed. */
    error: string | null;
    /** Which panel owns keyboard focus. */
    focusedPanel: "detail" | "list";
    /** All items surfaced in the TUI (one per applicable migration). */
    items: MigrateItem[];
    /** Current lifecycle phase. */
    phase: MigratePhase;
    /** Currently highlighted item index. */
    selectedIndex: number;
}

type Listener = () => void;

export class MigrateStore {
    #state: MigrateState;

    #listeners = new Set<Listener>();

    public constructor(items: MigrateItem[]) {
        this.#state = {
            applyProgress: null,
            checkedItems: new Set(items.map((item) => item.entry.id)),
            error: null,
            focusedPanel: "list",
            items,
            phase: "browsing",
            selectedIndex: 0,
        };
    }

    public getSnapshot = (): MigrateState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    public getCheckedItems(): MigrateItem[] {
        return this.#state.items.filter((item) => this.#state.checkedItems.has(item.entry.id));
    }

    public getSelectedItem(): MigrateItem | null {
        return this.#state.items[this.#state.selectedIndex] ?? null;
    }

    public setSelectedIndex(index: number): void {
        const clamped = Math.max(0, Math.min(index, this.#state.items.length - 1));

        if (clamped !== this.#state.selectedIndex) {
            this.#emit({ ...this.#state, selectedIndex: clamped });
        }
    }

    public setFocusedPanel(panel: "detail" | "list"): void {
        if (panel !== this.#state.focusedPanel) {
            this.#emit({ ...this.#state, focusedPanel: panel });
        }
    }

    public toggleCheck(id: string): void {
        const checked = new Set(this.#state.checkedItems);

        if (checked.has(id)) {
            checked.delete(id);
        } else {
            checked.add(id);
        }

        this.#emit({ ...this.#state, checkedItems: checked });
    }

    public checkAll(): void {
        this.#emit({ ...this.#state, checkedItems: new Set(this.#state.items.map((item) => item.entry.id)) });
    }

    public uncheckAll(): void {
        this.#emit({ ...this.#state, checkedItems: new Set() });
    }

    public toggleAll(): void {
        if (this.#state.checkedItems.size === this.#state.items.length) {
            this.uncheckAll();
        } else {
            this.checkAll();
        }
    }

    public startApply(): void {
        const total = this.getCheckedItems().length;

        this.#emit({ ...this.#state, applyProgress: { current: 0, total }, phase: "applying" });
    }

    public updateApplyProgress(current: number): void {
        if (this.#state.applyProgress) {
            this.#emit({ ...this.#state, applyProgress: { ...this.#state.applyProgress, current } });
        }
    }

    public markDone(): void {
        this.#emit({ ...this.#state, phase: "done" });
    }

    public setError(error: string): void {
        this.#emit({ ...this.#state, error, phase: "error" });
    }

    #emit(next: MigrateState): void {
        this.#state = next;

        for (const listener of this.#listeners) {
            try {
                listener();
            } catch {
                // isolate listener errors
            }
        }
    }
}
