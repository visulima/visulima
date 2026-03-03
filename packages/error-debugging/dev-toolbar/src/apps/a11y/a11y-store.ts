// ─── Exported types ───────────────────────────────────────────────────────────

export type Severity = "critical" | "minor" | "moderate" | "serious";

export type Standard = "best-practice" | "wcag21aa" | "wcag22aa" | "wcag2a";

export interface A11yNode {
    html: string;
    selector: string;
}

export interface A11yIssue {
    helpUrl: string;
    id: string;
    impact: Severity;
    message: string;
    nodes: A11yNode[];
    wcagTags: string[];
}

export interface A11yStoreState {
    isScanning: boolean;
    issues: A11yIssue[];
    lastScan: null | string; // ISO date string
    scanError: null | string;
    showOverlays: boolean;
    standard: Standard;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface AxeViolation {
    help: string;
    helpUrl: string;
    id: string;
    impact: null | string;
    nodes: { html: string; target: unknown[] }[];
    tags: string[];
}

interface PersistedData {
    issues: A11yIssue[];
    lastScan: null | string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SEVERITY_ORDER: Severity[] = ["critical", "serious", "moderate", "minor"];

const SEVERITY_OUTLINE_COLOR: Record<Severity, string> = {
    critical: "rgb(239,68,68)",
    minor: "rgb(100,116,139)",
    moderate: "rgb(249,115,22)",
    serious: "rgb(234,179,8)",
};

const RULE_SET_TAGS: Record<Standard, string[]> = {
    "best-practice": ["best-practice"],
    wcag2a: ["wcag2a"],
    wcag21aa: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    wcag22aa: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"],
};

// ─── Persistence ─────────────────────────────────────────────────────────────

const SESSION_KEY = "__vdt_a11y__";

const loadFromSession = (): PersistedData => {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);

        if (raw) {
            const parsed = JSON.parse(raw) as PersistedData;

            if (Array.isArray(parsed.issues)) {
                return { issues: parsed.issues, lastScan: parsed.lastScan ?? null };
            }
        }
    } catch {
        // ignore parse / quota errors
    }

    return { issues: [], lastScan: null };
};

// ─── Overlay DOM helpers ──────────────────────────────────────────────────────

const setHighlight = (element: Element, impact: Severity): void => {
    const h = element as HTMLElement;

    h.dataset["vdtA11y"] = impact;
    h.style.setProperty("outline", `2px solid ${SEVERITY_OUTLINE_COLOR[impact]}`, "important");
    h.style.setProperty("outline-offset", "2px", "important");
};

const clearHighlightsDOM = (): void => {
    for (const element of document.querySelectorAll("[data-vdt-a11y]")) {
        const h = element as HTMLElement;

        delete h.dataset["vdtA11y"];
        h.style.removeProperty("outline");
        h.style.removeProperty("outline-offset");
    }
};

const applyOverlaysDOM = (issues: A11yIssue[]): void => {
    clearHighlightsDOM();

    for (const issue of issues) {
        for (const node of issue.nodes) {
            try {
                const element = document.querySelector(node.selector);

                if (element) {
                    setHighlight(element, issue.impact);
                }
            } catch {
                // invalid selector — skip
            }
        }
    }
};

// ─── Axe scan helpers ─────────────────────────────────────────────────────────

const nodeSelector = (target: unknown[]): string => {
    const last = target.at(-1);

    if (Array.isArray(last)) {
        return (last as string[]).join(" ");
    }

    return String(last ?? "");
};

const convertViolations = (violations: AxeViolation[], disabledRules: string[]): A11yIssue[] => {
    const result: A11yIssue[] = [];

    for (const v of violations) {
        if (disabledRules.includes(v.id)) {
            continue;
        }

        result.push({
            helpUrl: v.helpUrl,
            id: v.id,
            impact: (v.impact ?? "minor") as Severity,
            message: v.help,
            nodes: v.nodes.map((n) => {
                return {
                    html: n.html,
                    selector: nodeSelector(n.target),
                };
            }),
            wcagTags: v.tags.filter((t) => t.startsWith("wcag") || t === "best-practice"),
        });
    }

    return result;
};

const runAxeScan = async (standard: Standard): Promise<{ violations: AxeViolation[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axeModule: any = await import("axe-core");
    // axe-core is a CJS-only package; ESM interop shape varies by bundler:
    //   Vite ESM interop  → { default: <axe api> }  (.default.run exists)
    //   esbuild CJS→ESM   → named exports on the ns  (.run exists directly)
    // Check which shape we got before calling .run.

    const axe = typeof axeModule.default?.run === "function" ? axeModule.default : axeModule;

    if (typeof axe.run !== "function") {
        throw new TypeError("axe-core could not be loaded — .run is not available");
    }

    return axe.run(document, {
        exclude: [["dev-toolbar"]],
        runOnly: { type: "tag", values: RULE_SET_TAGS[standard] },
    });
};

// ─── Store ────────────────────────────────────────────────────────────────────

type Listener = () => void;

class A11yStore {
    private listeners = new Set<Listener>();

    private state: A11yStoreState;

    public constructor() {
        const { issues, lastScan } = loadFromSession();

        this.state = {
            isScanning: false,
            issues,
            lastScan,
            scanError: null,
            showOverlays: false,
            standard: "wcag21aa",
        };
    }

    /** Remove all outline highlights from the page */
    public clearHighlights(): void {
        clearHighlightsDOM();
    }

    public getState(): Readonly<A11yStoreState> {
        return this.state;
    }

    /** Scroll to and outline a single issue's elements */
    public highlightIssue(issue: A11yIssue): void {
        clearHighlightsDOM();

        let scrolled = false;

        for (const node of issue.nodes) {
            try {
                const element = document.querySelector(node.selector);

                if (element) {
                    setHighlight(element, issue.impact);

                    if (!scrolled) {
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                        scrolled = true;
                    }
                }
            } catch {
                // invalid selector — skip
            }
        }
    }

    /** Run an axe-core scan and persist results */
    public async scan(disabledRules: string[] = []): Promise<void> {
        if (this.state.isScanning) {
            return;
        }

        this.update({ isScanning: true, scanError: null });

        try {
            const results = await runAxeScan(this.state.standard);
            const issues = convertViolations(results.violations, disabledRules);

            this.update({ isScanning: false, issues, lastScan: new Date().toISOString() });
            this.persist();

            if (this.state.showOverlays) {
                applyOverlaysDOM(issues);
            }
        } catch (error) {
            this.update({
                isScanning: false,
                scanError: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /** Toggle overlay highlights on all affected elements */
    public setShowOverlays(show: boolean): void {
        this.update({ showOverlays: show });

        if (show) {
            applyOverlaysDOM(this.state.issues);
        } else {
            clearHighlightsDOM();
        }
    }

    /** Change the WCAG standard used for future scans */
    public setStandard(standard: Standard): void {
        this.update({ standard });
    }

    public subscribe(function_: Listener): () => void {
        this.listeners.add(function_);

        return () => {
            this.listeners.delete(function_);
        };
    }

    private notify(): void {
        for (const function_ of this.listeners) {
            function_();
        }
    }

    private persist(): void {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ issues: this.state.issues, lastScan: this.state.lastScan }));
        } catch {
            // ignore storage quota errors
        }
    }

    private update(patch: Partial<A11yStoreState>): void {
        this.state = { ...this.state, ...patch };
        this.notify();
    }
}

export const a11yStore: A11yStore = new A11yStore();
