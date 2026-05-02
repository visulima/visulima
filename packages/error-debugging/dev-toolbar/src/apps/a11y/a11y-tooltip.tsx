/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { AppTooltipProps } from "../../types/app";
import type { A11yStoreState, Severity } from "./a11y-store";
import { a11yStore, SEVERITY_ORDER } from "./a11y-store";

// ─── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, string> = {
    critical: "text-destructive",
    minor: "text-muted-foreground",
    moderate: "text-warning-foreground",
    serious: "text-warning-foreground",
};

const SEVERITY_SHORT: Record<Severity, string> = {
    critical: "Crit",
    minor: "Min",
    moderate: "Mod",
    serious: "Ser",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable elapsed time string for an ISO timestamp.
 * @param isoDate ISO 8601 date string to compare against the current time
 * @returns Localized relative string such as "just now", "5s ago", or "2 hr ago"
 */
const formatElapsed = (isoDate: string): string => {
    const ts = new Date(isoDate).getTime();

    if (Number.isNaN(ts)) {
        return "unknown";
    }

    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));

    if (diffSec < 10) {
        return "just now";
    }

    if (diffSec < 60) {
        return `${diffSec}s ago`;
    }

    const diffMin = Math.floor(diffSec / 60);

    if (diffMin < 60) {
        return `${diffMin} min ago`;
    }

    return `${Math.floor(diffMin / 60)} hr ago`;
};

// ─── Main tooltip component ──────────────────────────────────────────────────

/**
 * Hover tooltip for the Accessibility app button.
 * Shows a summary of scan results and quick action buttons.
 * @param _props Tooltip props (unused; reads from a11yStore directly)
 * @returns Rendered tooltip component
 */

const A11yTooltip = (_props: AppTooltipProps): ComponentChildren => {
    const [state, setState] = useState<Readonly<A11yStoreState>>(() => a11yStore.getState());

    useEffect(() => a11yStore.subscribe(() => setState(a11yStore.getState())), []);

    const { isScanning, issues, lastScan, showOverlays } = state;

    const total = issues.length;
    const severityCounts: Record<Severity, number> = { critical: 0, minor: 0, moderate: 0, serious: 0 };

    for (const issue of issues) {
        severityCounts[issue.impact] = (severityCounts[issue.impact] ?? 0) + 1;
    }

    const countBy = (sev: Severity): number => severityCounts[sev];

    let scanButtonLabel: string;

    if (isScanning) {
        scanButtonLabel = "Scanning…";
    } else if (lastScan) {
        scanButtonLabel = "Re-scan";
    } else {
        scanButtonLabel = "Scan";
    }

    const overlayActiveClass = showOverlays
        ? "border-primary/30 text-primary bg-primary/8"
        : "border-border text-muted-foreground bg-transparent hover:text-foreground";
    const overlayButtonClass
        = issues.length === 0 ? "border-border/50 text-muted-foreground/40 bg-transparent cursor-not-allowed" : clsx("cursor-pointer", overlayActiveClass);

    return (
        <div class="space-y-3 min-w-[200px]">
            {/* Summary */}
            {lastScan ? (
                <>
                    <div class="flex items-baseline gap-2">
                        <span class={clsx("text-2xl font-bold tabular-nums leading-none", total > 0 ? "text-destructive" : "text-success-foreground")}>
                            {total}
                        </span>
                        <span class="text-[0.65rem] text-muted-foreground">violation{total === 1 ? "" : "s"}</span>
                    </div>

                    <div class="grid grid-cols-4 gap-1.5">
                        {SEVERITY_ORDER.map((sev) => (
                            <div class="flex flex-col items-center gap-0.5" key={sev}>
                                <span class={clsx("text-[0.85rem] font-bold tabular-nums leading-none", SEVERITY_COLOR[sev])}>{countBy(sev)}</span>
                                <span class="text-[0.55rem] uppercase tracking-wide text-muted-foreground/70">{SEVERITY_SHORT[sev]}</span>
                            </div>
                        ))}
                    </div>

                    <p class="text-[0.62rem] text-muted-foreground/50">Scanned {formatElapsed(lastScan)}</p>
                </>
            ) : (
                <div>
                    <p class="text-[0.72rem] text-muted-foreground">No scan run yet.</p>
                    <p class="text-[0.65rem] text-muted-foreground/50 mt-0.5">Scan this page to detect WCAG violations.</p>
                </div>
            )}

            {/* Actions */}
            <div class="flex items-center gap-2 pt-2 border-t border-border/50">
                <button
                    class={clsx(
                        "flex-1 px-2.5 py-1.5 text-[0.7rem] font-medium border transition-colors cursor-pointer",
                        isScanning
                            ? "border-primary/30 text-primary/50 bg-primary/5 cursor-not-allowed"
                            : "border-border text-foreground bg-transparent hover:bg-foreground/5",
                    )}
                    disabled={isScanning}
                    onClick={() => {
                        a11yStore.scan().catch(() => {
                            /* error handled in store */
                        });
                    }}
                    type="button"
                >
                    {scanButtonLabel}
                </button>

                <button
                    class={clsx("px-2.5 py-1.5 text-[0.7rem] border transition-colors", overlayButtonClass)}
                    disabled={issues.length === 0}
                    onClick={() => a11yStore.setShowOverlays(!showOverlays)}
                    title="Toggle visual highlights on affected elements"
                    type="button"
                >
                    Overlays
                </button>
            </div>
        </div>
    );
};

export default A11yTooltip;
