/** @jsxImportSource preact */
import type { JSX } from "preact";

import CopyButton from "./copy-button";
import { ShortPath, ValueCell } from "./value";

const PATH_SHORTEN_AT = 40;

const LOOKS_LIKE_PATH = /^\/|^[A-Z]:\\/i;

const COLUMN_LABEL = "text-xxs font-bold uppercase tracking-widest text-muted-foreground";

interface PairTableProps {
    /** Left column heading. */
    keyLabel: string;

    /** Accent class for the left cell — distinguishes an alias from a define. */
    keyTone?: "amber" | "primary";

    /** Rows, pre-stringified by the spec builder. */
    rows: { key: string; value: string }[];

    /** Show a copy button per row (`key=value`). */
    showCopy?: boolean;

    /** Right column heading. */
    valueLabel: string;
}

const keyToneClasses = {
    amber: "text-amber-400",
    primary: "text-primary",
};

/** Two-column table of string pairs — alias finds, define constants. */
const PairTable = ({ keyLabel, keyTone = "primary", rows, showCopy = false, valueLabel }: PairTableProps): JSX.Element => (
    <>
        <div class="grid grid-cols-2 gap-4 px-4 py-1.5 bg-secondary border-b border-border">
            <span class={COLUMN_LABEL}>{keyLabel}</span>
            <span class={COLUMN_LABEL}>{valueLabel}</span>
        </div>
        {rows.map(({ key, value }) => (
            <div class="grid grid-cols-2 gap-4 px-4 py-1.5 border-t border-border hover:bg-secondary transition-colors duration-100" key={key}>
                <code class={`text-xs font-mono break-all leading-relaxed self-center ${keyToneClasses[keyTone]}`}>{key}</code>
                <div class="flex items-center gap-2 self-center min-w-0">
                    <div class="flex-1 min-w-0">
                        {LOOKS_LIKE_PATH.test(value) && value.length > PATH_SHORTEN_AT ? <ShortPath path={value} /> : <ValueCell value={value} />}
                    </div>
                    {showCopy && <CopyButton text={`${key}=${value}`} />}
                </div>
            </div>
        ))}
    </>
);

export default PairTable;
