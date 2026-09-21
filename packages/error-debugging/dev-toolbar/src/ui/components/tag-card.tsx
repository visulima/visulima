/** @jsxImportSource preact */
import type { JSX } from "preact";

import Badge from "./badge";
import CopyButton from "./copy-button";

interface TagCardProps {
    description: string;
    label: string;
    priority: "recommended" | "required";
    /** The markup to add, offered for copying. */
    snippet: string;
}

/** A tag the page is missing, with what it is for and the line that adds it. */
const TagCard = ({ description, label, priority, snippet }: TagCardProps): JSX.Element => (
    <div class="border border-border/60 bg-card p-3 space-y-2">
        <div class="flex items-start justify-between gap-3">
            <code class="text-[0.7rem] font-mono font-bold text-foreground">{label}</code>
            <Badge class="text-[0.58rem] uppercase tracking-wide shrink-0" variant={priority === "required" ? "destructive" : "warning"}>
                {priority}
            </Badge>
        </div>
        <p class="text-[0.7rem] text-muted-foreground leading-relaxed">{description}</p>
        <div class="flex items-center gap-2">
            <code class="flex-1 min-w-0 text-[0.65rem] font-mono text-muted-foreground bg-foreground/4 border border-border/40 px-2 py-1 overflow-x-auto whitespace-nowrap block">
                {snippet}
            </code>
            <CopyButton text={snippet} />
        </div>
    </div>
);

export default TagCard;
