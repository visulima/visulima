/** @jsxImportSource preact */
import type { JSX } from "preact";

/** Single-value row — a proxy route, a lone identifier. */
const Row = ({ value }: { value: string }): JSX.Element => (
    <div class="flex items-center gap-3 px-4 py-1.5 hover:bg-secondary transition-colors duration-100">
        <code class="text-xs font-mono text-primary">{value}</code>
    </div>
);

export default Row;
