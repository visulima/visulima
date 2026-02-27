/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";
import { a11yStore, SEVERITY_ORDER } from "./a11y-store";
import type { A11yIssue, A11yStoreState, Severity, Standard } from "./a11y-store";

// ─── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<Severity, string> = {
    critical: "Critical",
    minor: "Minor",
    moderate: "Moderate",
    serious: "Serious",
};

const SEVERITY_COLOR: Record<Severity, string> = {
    critical: "text-destructive",
    minor: "text-muted-foreground",
    moderate: "text-warning-foreground",
    serious: "text-warning-foreground",
};

const SEVERITY_BG: Record<Severity, string> = {
    critical: "bg-destructive/10 border-destructive/30",
    minor: "bg-foreground/[0.04] border-border",
    moderate: "bg-warning/10 border-warning/30",
    serious: "bg-warning/10 border-warning/30",
};

const SEVERITY_DOT: Record<Severity, string> = {
    critical: "bg-destructive",
    minor: "bg-muted-foreground/50",
    moderate: "bg-warning",
    serious: "bg-warning",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SeverityBucket = ({
    count,
    isActive,
    onClick,
    severity,
}: {
    count: number;
    isActive: boolean;
    onClick: () => void;
    severity: Severity;
}): ComponentChildren => (
    <button
        class={cn(
            "flex flex-col items-center gap-1 px-3 py-2.5 border cursor-pointer transition-colors",
            isActive ? "ring-1 ring-inset ring-primary/40" : "hover:bg-foreground/[0.06]",
            SEVERITY_BG[severity],
        )}
        onClick={onClick}
        title={`${isActive ? "Clear" : "Filter by"} ${SEVERITY_LABEL[severity]}`}
        type="button"
    >
        <span class={cn("text-xl font-bold tabular-nums leading-none", SEVERITY_COLOR[severity])}>{count}</span>
        <span class="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">{SEVERITY_LABEL[severity]}</span>
    </button>
);

interface IssueCardProps {
    isSelected: boolean;
    issue: A11yIssue;
    onClick: () => void;
    onDisable: (ruleId: string) => void;
}

const IssueCard = ({ isSelected, issue, onClick, onDisable }: IssueCardProps): ComponentChildren => (
    <div
        class={cn(
            "p-3 border cursor-pointer transition-colors",
            isSelected ? "bg-foreground/[0.06] border-primary/30" : "border-border hover:bg-foreground/[0.03]",
        )}
        onClick={onClick}
    >
        {/* Header */}
        <div class="flex items-start gap-2 mb-1.5">
            <span class={cn("mt-1 size-2 rounded-full shrink-0", SEVERITY_DOT[issue.impact])} />
            <span class="text-[0.75rem] font-semibold text-foreground flex-1 leading-snug">{issue.id}</span>
            <span class={cn("text-[0.6rem] font-bold uppercase tracking-wide shrink-0", SEVERITY_COLOR[issue.impact])}>
                {SEVERITY_LABEL[issue.impact]}
            </span>
        </div>
        {/* Message */}
        <p class="text-[0.7rem] text-muted-foreground leading-relaxed mb-2 ml-4">{issue.message}</p>
        {/* Nodes */}
        {issue.nodes.length > 0 && (
            <div class="mb-2 ml-4 space-y-0.5">
                {issue.nodes.slice(0, 3).map((node, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <code key={i} class="block text-[0.65rem] text-foreground/70 font-mono bg-foreground/[0.05] px-2 py-1 truncate">
                        {node.selector}
                    </code>
                ))}
                {issue.nodes.length > 3 && (
                    <span class="text-[0.62rem] text-muted-foreground/60">
                        +{issue.nodes.length - 3} more element{issue.nodes.length > 4 ? "s" : ""}
                    </span>
                )}
            </div>
        )}
        {/* Footer */}
        <div class="flex items-center gap-2 flex-wrap ml-4">
            {issue.wcagTags.slice(0, 3).map((tag) => (
                <span key={tag} class="text-[0.58rem] font-mono uppercase bg-primary/[0.08] text-primary/70 border border-primary/20 px-1.5 py-0.5">
                    {tag}
                </span>
            ))}
            <span class="flex-1" />
            <a
                class="text-[0.62rem] text-primary/70 hover:text-primary transition-colors"
                href={issue.helpUrl}
                onClick={(e) => e.stopPropagation()}
                rel="noopener noreferrer"
                target="_blank"
            >
                Learn more ↗
            </a>
            <button
                class="text-[0.62rem] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer bg-transparent border-0 p-0"
                onClick={(e) => {
                    e.stopPropagation();
                    onDisable(issue.id);
                }}
                title="Disable this rule for current session"
                type="button"
            >
                Disable
            </button>
        </div>
    </div>
);

// ─── Main component ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const A11yApp = (_props: AppComponentProps): ComponentChildren => {
    const [storeState, setStoreState] = useState<Readonly<A11yStoreState>>(() => a11yStore.getState());
    const [disabledRules, setDisabledRules] = useState<string[]>([]);
    const [minSeverity, setMinSeverity] = useState<Severity | null>(null);
    const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
    const [filterSeverity, setFilterSeverity] = useState<Severity | null>(null);

    useEffect(() => a11yStore.subscribe(() => setStoreState(a11yStore.getState())), []);

    // Clean up highlights on unmount
    useEffect(() => a11yStore.clearHighlights.bind(a11yStore), []);

    const { isScanning, issues, lastScan, scanError, showOverlays, standard } = storeState;
    const hasDone = lastScan !== null || scanError !== null;

    const handleScan = (): void => {
        setFilterSeverity(null);
        setActiveIssueId(null);
        void a11yStore.scan(disabledRules);
    };

    const handleIssueClick = (issue: A11yIssue): void => {
        if (activeIssueId === issue.id) {
            setActiveIssueId(null);
            a11yStore.clearHighlights();

            if (showOverlays) {
                a11yStore.setShowOverlays(true);
            }
        } else {
            setActiveIssueId(issue.id);
            a11yStore.highlightIssue(issue);
        }
    };

    const handleDisableRule = (ruleId: string): void => {
        setDisabledRules((prev) => [...prev, ruleId]);
    };

    const displayedIssues = issues.filter((i) => {
        if (disabledRules.includes(i.id)) {
            return false;
        }

        if (filterSeverity && i.impact !== filterSeverity) {
            return false;
        }

        if (minSeverity && SEVERITY_ORDER.indexOf(i.impact) > SEVERITY_ORDER.indexOf(minSeverity)) {
            return false;
        }

        return true;
    });

    const countBy = (sev: Severity): number => issues.filter((i) => !disabledRules.includes(i.id) && i.impact === sev).length;

    return (
        <div class="flex flex-col h-full">
            {/* Toolbar */}
            <div class="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-foreground/[0.02] flex-wrap">
                <button
                    class={cn(
                        "px-3 py-1.5 text-[0.7rem] font-medium border transition-colors cursor-pointer",
                        isScanning
                            ? "border-primary/30 text-primary/50 bg-primary/[0.05] cursor-not-allowed"
                            : "border-border text-foreground bg-transparent hover:bg-foreground/[0.05]",
                    )}
                    disabled={isScanning}
                    onClick={handleScan}
                    type="button"
                >
                    {isScanning ? "Scanning…" : "Scan page"}
                </button>

                <label class="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                    Standard
                    <select
                        class="bg-card border border-border text-foreground text-[0.7rem] px-1.5 py-1 cursor-pointer"
                        onChange={(e) => a11yStore.setStandard((e.target as HTMLSelectElement).value as Standard)}
                        style="color-scheme: dark"
                        value={standard}
                    >
                        <option value="wcag21aa">WCAG 2.1 AA</option>
                        <option value="wcag22aa">WCAG 2.2 AA</option>
                        <option value="wcag2a">WCAG 2.0 A</option>
                        <option value="best-practice">Best Practice</option>
                    </select>
                </label>

                <label class="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                    Min
                    <select
                        class="bg-card border border-border text-foreground text-[0.7rem] px-1.5 py-1 cursor-pointer"
                        onChange={(e) => {
                            const val = (e.target as HTMLSelectElement).value;

                            setMinSeverity(val ? (val as Severity) : null);
                        }}
                        style="color-scheme: dark"
                        value={minSeverity ?? ""}
                    >
                        <option value="">All</option>
                        <option value="critical">Critical only</option>
                        <option value="serious">Serious+</option>
                        <option value="moderate">Moderate+</option>
                    </select>
                </label>

                <button
                    class={cn(
                        "px-2.5 py-1.5 text-[0.7rem] border transition-colors cursor-pointer",
                        showOverlays
                            ? "border-primary/30 text-primary bg-primary/[0.08]"
                            : "border-border text-muted-foreground bg-transparent hover:text-foreground",
                    )}
                    onClick={() => a11yStore.setShowOverlays(!showOverlays)}
                    title="Toggle visual highlights on affected elements"
                    type="button"
                >
                    Overlays
                </button>

                {hasDone && issues.length > 0 && (
                    <>
                        <button
                            class="ml-auto px-2 py-1.5 text-[0.7rem] border border-border text-muted-foreground bg-transparent hover:text-foreground transition-colors cursor-pointer"
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(issues, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "a11y-audit.json";
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            title="Export audit results as JSON"
                            type="button"
                        >
                            JSON
                        </button>
                        <button
                            class="px-2 py-1.5 text-[0.7rem] border border-border text-muted-foreground bg-transparent hover:text-foreground transition-colors cursor-pointer"
                            onClick={() => {
                                const q = (s: string): string => `"${s.replaceAll('"', '""')}"`;
                                const header = ["Rule ID", "Severity", "Message", "Selector", "HTML", "WCAG Tags"].join(",");
                                const rows = issues.flatMap((issue) =>
                                    issue.nodes.map((node) =>
                                        [q(issue.id), q(issue.impact), q(issue.message), q(node.selector), q(node.html), q(issue.wcagTags.join("; "))].join(","),
                                    ),
                                );
                                const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "a11y-audit.csv";
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            title="Export audit results as CSV"
                            type="button"
                        >
                            CSV
                        </button>
                    </>
                )}
            </div>

            {/* Content area */}
            <div class="flex-1 overflow-y-auto devtools-content-scroll">
                {/* Error */}
                {scanError && (
                    <div class="p-4 bg-destructive/10 border-b border-destructive/30">
                        <p class="text-[0.72rem] text-destructive font-medium">Scan failed: {scanError}</p>
                    </div>
                )}

                {/* Idle state */}
                {!hasDone && !isScanning && (
                    <div class="flex flex-col items-center justify-center gap-4 p-8 min-h-48 text-center">
                        <p class="text-[0.8125rem] text-muted-foreground max-w-sm">
                            Run an accessibility audit using axe-core to detect WCAG violations on this page.
                        </p>
                        <button
                            class="px-4 py-2 text-[0.75rem] font-medium border border-border text-foreground bg-transparent hover:bg-foreground/[0.05] transition-colors cursor-pointer"
                            onClick={handleScan}
                            type="button"
                        >
                            Start scan
                        </button>
                    </div>
                )}

                {/* Scanning */}
                {isScanning && (
                    <div class="flex items-center justify-center gap-3 p-8 min-h-48">
                        <span class="text-[0.8rem] text-muted-foreground">Scanning for accessibility issues…</span>
                    </div>
                )}

                {/* Results */}
                {hasDone && !isScanning && !scanError && (
                    <div class="p-5 space-y-4">
                        {/* Summary grid */}
                        <div class="grid grid-cols-4 gap-2">
                            {SEVERITY_ORDER.map((sev) => (
                                <SeverityBucket
                                    key={sev}
                                    count={countBy(sev)}
                                    isActive={filterSeverity === sev}
                                    onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
                                    severity={sev}
                                />
                            ))}
                        </div>

                        {displayedIssues.length === 0 ? (
                            <div class="p-6 text-center border border-border">
                                <p class="text-[0.8125rem] font-medium text-foreground/70">
                                    {issues.length === 0 ? "No violations found!" : "No issues match the current filters."}
                                </p>
                                {issues.length === 0 && (
                                    <p class="mt-1 text-[0.7rem] text-muted-foreground">
                                        Great — the page passes all rules for the selected standard.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <section>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                        <span aria-hidden="true" class="text-primary/50">//</span>{" "}
                                        {displayedIssues.length} issue{displayedIssues.length !== 1 ? "s" : ""}
                                        {filterSeverity ? ` · ${SEVERITY_LABEL[filterSeverity]} only` : ""}
                                    </span>
                                    {filterSeverity && (
                                        <button
                                            class="text-[0.62rem] text-primary/70 hover:text-primary cursor-pointer bg-transparent border-0 p-0 transition-colors"
                                            onClick={() => setFilterSeverity(null)}
                                            type="button"
                                        >
                                            Clear ×
                                        </button>
                                    )}
                                </div>
                                <div class="space-y-2">
                                    {displayedIssues.map((issue) => (
                                        <IssueCard
                                            key={issue.id}
                                            isSelected={activeIssueId === issue.id}
                                            issue={issue}
                                            onClick={() => handleIssueClick(issue)}
                                            onDisable={handleDisableRule}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {disabledRules.length > 0 && (
                            <div class="flex items-center gap-2 text-[0.65rem] text-muted-foreground/60">
                                <span>
                                    {disabledRules.length} rule{disabledRules.length !== 1 ? "s" : ""} disabled this session.
                                </span>
                                <button
                                    class="text-primary/60 hover:text-primary cursor-pointer bg-transparent border-0 p-0 transition-colors"
                                    onClick={() => setDisabledRules([])}
                                    type="button"
                                >
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default A11yApp;
