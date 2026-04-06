import type { ProjectGraph, ProjectGraphDependency, ProjectGraphProjectNode } from "@visulima/task-runner";

// ── State Shape ─────────────────────────────────────────────────────────

export type GraphFilterType = "all" | "app" | "lib";

export interface GraphNode {
    deps: ProjectGraphDependency[];
    name: string;
    reverseDeps: string[];
    type: string;
}

export interface GraphState {
    /** All nodes. */
    allNodes: GraphNode[];
    /** Whether the text filter input is active. */
    filterActive: boolean;
    /** Current filter text. */
    filterText: string;
    /** Filter by project type. */
    filterType: GraphFilterType;
    /** Which panel has keyboard focus. */
    focusedPanel: "detail" | "list";
    /** Currently highlighted entry index in the filtered list. */
    selectedIndex: number;
}

type Listener = () => void;

// ── Helpers ─────────────────────────────────────────────────────────────

const buildNodes = (projectGraph: ProjectGraph): GraphNode[] => {
    const reverseDeps = new Map<string, string[]>();

    for (const [source, deps] of Object.entries(projectGraph.dependencies)) {
        for (const dep of deps) {
            const existing = reverseDeps.get(dep.target) ?? [];

            existing.push(source);
            reverseDeps.set(dep.target, existing);
        }
    }

    return Object.values(projectGraph.nodes)
        .map((node: ProjectGraphProjectNode) => {
            return {
                deps: projectGraph.dependencies[node.name] ?? [],
                name: node.name,
                reverseDeps: reverseDeps.get(node.name) ?? [],
                type: node.type,
            };
        })
        .sort((a, b) => {
            // Apps first, then libs, alphabetical within each group
            if (a.type !== b.type) {
                return a.type === "application" ? -1 : 1;
            }

            return a.name.localeCompare(b.name);
        });
};

const filterNodes = (allNodes: GraphNode[], filterType: GraphFilterType, filterText: string): GraphNode[] => {
    let filtered = allNodes;

    if (filterType === "app") {
        filtered = filtered.filter((n) => n.type === "application");
    } else if (filterType === "lib") {
        filtered = filtered.filter((n) => n.type !== "application");
    }

    if (filterText) {
        const lower = filterText.toLowerCase();

        filtered = filtered.filter((n) => n.name.toLowerCase().includes(lower));
    }

    return filtered;
};

// ── GraphStore ──────────────────────────────────────────────────────────

export class GraphStore {
    #state: GraphState;

    #listeners = new Set<Listener>();

    #projectGraph: ProjectGraph;

    public constructor(projectGraph: ProjectGraph) {
        this.#projectGraph = projectGraph;

        const allNodes = buildNodes(projectGraph);

        this.#state = {
            allNodes,
            filterActive: false,
            filterText: "",
            filterType: "all",
            focusedPanel: "list",
            selectedIndex: 0,
        };
    }

    // ── React integration ───────────────────────────────────────────

    public getSnapshot = (): GraphState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    // ── Derived data ────────────────────────────────────────────────

    public getFilteredNodes(): GraphNode[] {
        return filterNodes(this.#state.allNodes, this.#state.filterType, this.#state.filterText);
    }

    public getStats(): { apps: number; deps: number; libs: number; total: number } {
        const apps = this.#state.allNodes.filter((n) => n.type === "application").length;
        const total = this.#state.allNodes.length;
        const deps = Object.values(this.#projectGraph.dependencies).reduce((s, d) => s + d.length, 0);

        return { apps, deps, libs: total - apps, total };
    }

    // ── Navigation ──────────────────────────────────────────────────

    public setSelectedIndex(index: number): void {
        const filtered = this.getFilteredNodes();
        const clamped = filtered.length === 0 ? -1 : Math.max(0, Math.min(index, filtered.length - 1));

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

    public setFilterType(type: GraphFilterType): void {
        if (type !== this.#state.filterType) {
            this.#emit({
                ...this.#state,
                filterType: type,
                selectedIndex: 0,
            });
        }
    }

    public setFilter(text: string): void {
        this.#emit({
            ...this.#state,
            filterText: text,
            selectedIndex: 0,
        });
    }

    public setFilterActive(active: boolean): void {
        if (active !== this.#state.filterActive) {
            this.#emit({
                ...this.#state,
                filterActive: active,
                filterText: active ? this.#state.filterText : "",
                selectedIndex: active ? this.#state.selectedIndex : 0,
            });
        }
    }

    // ── Internal ────────────────────────────────────────────────────

    #emit(newState: GraphState): void {
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
