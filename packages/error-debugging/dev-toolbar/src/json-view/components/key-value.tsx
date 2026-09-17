/** @jsxImportSource preact */
import type { JSX } from "preact";

import { ValueCell } from "./value";

/**
 * One `label → value` row.
 *
 * Renders nothing when the value is absent, so a spec can list every known
 * config key without the panel filling up with empty rows.
 */
const KeyValue = ({ label, value }: { label: string; value?: unknown }): JSX.Element | null => {
    if (value === undefined || value === null) {
        return null;
    }

    return (
        <div class="grid grid-cols-2 gap-4 px-4 py-1.5 hover:bg-secondary transition-colors duration-100">
            <span class="text-xs text-muted-foreground font-mono select-none self-center">{label}</span>
            <div class="text-xs min-w-0 self-center">
                <ValueCell value={value} />
            </div>
        </div>
    );
};

export default KeyValue;
