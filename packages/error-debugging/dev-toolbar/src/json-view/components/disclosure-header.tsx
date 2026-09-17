/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

import { Badge } from "../../ui";
import type { Severity } from "./message-list";
import { SEVERITY_CONFIG } from "./message-list";

const BADGE_VARIANT: Record<Severity, "destructive" | "outline" | "success" | "warning"> = {
    error: "destructive",
    ok: "success",
    suggestion: "outline",
    warning: "warning",
};

interface DisclosureHeaderProps {
    /** Bind to a state path so the chevron follows the body it controls. */
    expanded?: boolean;
    /** Monospace prefix — which script, which index. */
    label: string;
    onClick?: (event: Event) => void;
    severity: Severity;
    /** The subject of the row, shown in bold. */
    title: string;
}

/**
 * Clickable row that expands the element following it.
 *
 * Holds no state: `expanded` is a bound prop and the click is an `on` binding,
 * so a spec can drive the pair with a `toggle` action and a `visible` condition.
 */
const DisclosureHeader = ({ expanded = false, label, onClick, severity, title }: DisclosureHeaderProps): JSX.Element => (
    <button
        aria-expanded={expanded}
        class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer text-left hover:bg-foreground/3 transition-colors"
        onClick={onClick}
        type="button"
    >
        <div class="flex items-center gap-2 min-w-0">
            <span class={clsx("text-base shrink-0 leading-none", SEVERITY_CONFIG[severity].color)}>{SEVERITY_CONFIG[severity].icon}</span>
            <span class="text-[0.7rem] text-muted-foreground font-mono shrink-0">{label}</span>
            <code class="text-[0.75rem] font-mono font-semibold text-foreground truncate">{title}</code>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <Badge variant={BADGE_VARIANT[severity]}>{SEVERITY_CONFIG[severity].label}</Badge>
            <span class={clsx("text-muted-foreground text-[0.65rem] transition-transform duration-150", expanded ? "rotate-90" : "")}>▶</span>
        </div>
    </button>
);

export default DisclosureHeader;
