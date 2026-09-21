/** @jsxImportSource preact */
import type { JSX } from "preact";

/** Scrollable preformatted block for raw source — JSON-LD, a snippet. */
const CodeBlock = ({ code }: { code: string }): JSX.Element => (
    <pre class="text-[0.65rem] font-mono leading-relaxed bg-foreground/3 border-t border-border/50 px-4 py-3 overflow-x-auto max-h-60 text-muted-foreground whitespace-pre-wrap break-all m-0">
        {code}
    </pre>
);

export default CodeBlock;
