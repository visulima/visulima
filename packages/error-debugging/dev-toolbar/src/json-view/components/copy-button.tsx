/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

import { useCopy } from "../../ui";

/** Copy-to-clipboard button. The flash is the shared `useCopy` behaviour. */
const CopyButton = ({ text }: { text: string }): JSX.Element => {
    const { copied, copy } = useCopy();

    return (
        <button
            class={clsx(
                "inline-flex items-center px-1.5 py-0.5 text-xxs font-mono border transition-colors duration-150 cursor-pointer",
                copied
                    ? "border-primary text-primary bg-card"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground bg-transparent",
            )}
            onClick={() => {
                copy(text);
            }}
            title="Copy to clipboard"
            type="button"
        >
            {copied ? "copied" : "copy"}
        </button>
    );
};

export default CopyButton;
