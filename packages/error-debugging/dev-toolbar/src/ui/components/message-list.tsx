/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

/** Glyph and tone per severity, shared with the disclosure header. */
export const SEVERITY_CONFIG = {
    error: { color: "text-destructive", icon: "✖", label: "Error" },
    ok: { color: "text-success", icon: "✔", label: "OK" },
    suggestion: { color: "text-primary", icon: "ℹ", label: "Info" },
    warning: { color: "text-warning", icon: "⚠", label: "Warning" },
} as const;

export type Severity = keyof typeof SEVERITY_CONFIG;

export interface ValidationMessage {
    message: string;
    /** The offending property path, shown before the message. */
    property?: string;
    severity: Severity;
}

/** Validation findings, or a single line confirming there are none. */
export const MessageList = ({ emptyText = "No issues found", messages }: { emptyText?: string; messages: ValidationMessage[] }): JSX.Element => {
    if (messages.length === 0) {
        return (
            <div class="px-4 py-3 flex items-center gap-2 text-[0.72rem] text-success">
                <span>✔</span>
                <span>{emptyText}</span>
            </div>
        );
    }

    return (
        <div class="px-4 py-3 space-y-1.5">
            {messages.map(({ message, property, severity }) => (
                <div class="flex items-start gap-2 text-[0.72rem]" key={`${property ?? ""}:${message}`}>
                    <span class={clsx("shrink-0 leading-none mt-px", SEVERITY_CONFIG[severity].color)}>{SEVERITY_CONFIG[severity].icon}</span>
                    <div class="min-w-0">
                        {property !== undefined && property !== "" && <code class="text-[0.65rem] font-mono text-muted-foreground mr-1.5">{property}:</code>}
                        <span class="text-foreground/80">{message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
