/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";
import { useState } from "preact/hooks";

const COPIED_RESET_MS = 1500;

/** Copy-to-clipboard button. Owns its own `copied` flash, so no view state is needed for it. */
const CopyButton = ({ text }: { text: string }): JSX.Element => {
    const [copied, setCopied] = useState(false);

    const copy = (): void => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(setCopied, COPIED_RESET_MS, false);

                return undefined;
            })
            .catch(() => {
                /* clipboard unavailable — nothing useful to show */
            });
    };

    return (
        <button
            class={clsx(
                "inline-flex items-center px-1.5 py-0.5 text-xxs font-mono border transition-colors duration-150 cursor-pointer",
                copied
                    ? "border-primary text-primary bg-card"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground bg-transparent",
            )}
            onClick={copy}
            title="Copy to clipboard"
            type="button"
        >
            {copied ? "copied" : "copy"}
        </button>
    );
};

export default CopyButton;
