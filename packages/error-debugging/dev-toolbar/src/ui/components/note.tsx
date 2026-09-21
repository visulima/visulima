/** @jsxImportSource preact */
import type { JSX } from "preact";

/** Bordered explanatory line for an empty or not-applicable section. */
const Note = ({ text }: { text: string }): JSX.Element => (
    <div class="rounded-none border border-border bg-card border-l-2 border-l-primary/20 px-4 py-3">
        <p class="text-xs text-muted-foreground">{text}</p>
    </div>
);

export default Note;
