/** @jsxImportSource preact */
import type { JSX } from "preact";

import { Badge, Button } from "../../ui";

type BadgeVariant = "default" | "destructive" | "info" | "outline" | "secondary" | "success" | "warning";

interface HeaderBarProps {
    /** Trailing button label. Omit for no button. */
    actionLabel?: string;

    /** Leading status pills. */
    badges?: { label: string; variant?: BadgeVariant }[];

    /** Monospace context chips, e.g. a shortened root path. */
    chips?: { label: string; title?: string }[];

    /** Wired by the view's `on.action` binding when a trailing button is wanted. */
    onAction?: (event: Event) => void;
}

/** Panel header: status pills, context chips, and one optional trailing action. */
const HeaderBar = ({ actionLabel, badges = [], chips = [], onAction }: HeaderBarProps): JSX.Element => (
    <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 flex-wrap">
        {badges.map(({ label, variant = "default" }) => (
            <Badge class="uppercase tracking-wider text-xxs" key={label} variant={variant}>
                {label}
            </Badge>
        ))}
        {chips.map(({ label, title }) => (
            <code class="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 border border-border truncate max-w-xs" key={label} title={title}>
                {label}
            </code>
        ))}
        {actionLabel && (
            <Button class="ml-auto shrink-0 text-xs" onClick={onAction} size="sm" variant="outline">
                {actionLabel}
            </Button>
        )}
    </div>
);

export default HeaderBar;
