/** @jsxImportSource preact */
import type { JSX } from "preact";

import CopyButton from "../../../json-view/components/copy-button";

interface RawToggleRowProps {
    /** Bound to the same state path the click toggles. */
    expanded?: boolean;
    onClick?: (event: Event) => void;
    /** Offered for copying — the raw source itself. */
    text: string;
}

/** Row that reveals a schema's raw JSON, and copies it. */
const RawToggleRow = ({ expanded = false, onClick, text }: RawToggleRowProps): JSX.Element => (
    <div class="border-t border-border/50 px-4 py-2 flex items-center justify-between">
        <button
            aria-expanded={expanded}
            class="text-[0.65rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer p-0"
            onClick={onClick}
            type="button"
        >
            {expanded ? "Hide" : "Show"} raw JSON
        </button>
        <CopyButton text={text} />
    </div>
);

export default RawToggleRow;
