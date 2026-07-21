/* eslint-disable react/function-component-definition */

/**
 * Clickable terminal link component for Ink.
 *
 * Based on ink-link by Sindre Sorhus.
 * @see https://github.com/sindresorhus/ink-link
 *
 * MIT License
 * Copyright (c) Sindre Sorhus (https://sindresorhus.com)
 */
import { hyperlink } from "@visulima/ansi";
import Text from "@visulima/tui/components/text";
import Transform from "@visulima/tui/components/transform";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";

type Props = {
    readonly children: ReactNode;

    /**
     * Determines whether the URL should be printed for unsupported terminals.
     *
     * - `true` (default): appends the URL after the text, e.g. `"My website https://example.com"`
     * - `false`: renders just the text with no URL
     * - `function`: custom fallback formatting, e.g. `(text, url) => \`[\${text}](\${url})\``
     * @default true
     */
    readonly fallback?: ((text: string, url: string) => string) | boolean;

    /**
     * The URL to link to.
     */
    readonly url: string;
};

/**
 * Lightweight check for OSC 8 hyperlink support.
 *
 * Covers the most common terminals. For exhaustive detection,
 * use the `supports-hyperlinks` package externally.
 */
let cachedSupportsHyperlinks: boolean | undefined;

const detectHyperlinkSupport = (): boolean => {
    // Not a TTY — no hyperlink support
    if (!process.stdout.isTTY) {
        return false;
    }

    const term = process.env["TERM_PROGRAM"] ?? "";
    const termVersion = process.env["TERM_PROGRAM_VERSION"] ?? "";

    // Known supporting terminals
    if (term === "iTerm.app") {
        const major = Number.parseInt(termVersion.split(".")[0] ?? "0", 10);

        return major >= 3;
    }

    if (term === "WezTerm" || term === "ghostty") {
        return true;
    }

    if (term === "vscode") {
        const parts = termVersion.split(".");
        const major = Number.parseInt(parts[0] ?? "0", 10);
        const minor = Number.parseInt(parts[1] ?? "0", 10);

        return major > 1 || (major === 1 && minor >= 72);
    }

    // Windows Terminal
    if (process.env["WT_SESSION"]) {
        return true;
    }

    // VTE-based terminals (GNOME Terminal, Tilix, etc.)
    const vteVersion = process.env["VTE_VERSION"];

    if (vteVersion) {
        const v = Number.parseInt(vteVersion, 10);

        return v >= 5000 && v !== 5000;
    }

    return false;
};

const supportsHyperlinks = (): boolean => {
    // Skip cache when FORCE_HYPERLINK is set (allows runtime override)
    if (process.env["FORCE_HYPERLINK"]) {
        return process.env["FORCE_HYPERLINK"] !== "0";
    }

    if (cachedSupportsHyperlinks !== undefined) {
        return cachedSupportsHyperlinks;
    }

    cachedSupportsHyperlinks = detectHyperlinkSupport();

    return cachedSupportsHyperlinks;
};

/**
 * An Ink component that creates clickable links in the terminal using OSC 8 hyperlink sequences.
 *
 * [Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
 *
 * For unsupported terminals, the link will be printed after the text: `My website https://example.com`.
 *
 * ```tsx
 * import { Link, Text } from "@visulima/tui/ink";
 *
 * &lt;Link url="https://example.com"&gt;
 *     &lt;Text color="cyan"&gt;My Website&lt;/Text&gt;
 * &lt;/Link&gt;
 * ```
 */
export default function Link({ children, fallback = true, url }: Props): ReactElement {
    const transform = useCallback(
        (text: string) => {
            // Check if the terminal supports hyperlinks via OSC 8.
            // If FORCE_HYPERLINK is set, always use the hyperlink sequence.
            // Otherwise, check common terminal environment indicators.
            if (supportsHyperlinks()) {
                return hyperlink(text, url);
            }

            if (fallback === false) {
                return text;
            }

            if (typeof fallback === "function") {
                return fallback(text, url);
            }

            return `${text} ${url}`;
        },
        [fallback, url],
    );

    return (
        <Transform transform={transform}>
            <Text>{children}</Text>
        </Transform>
    );
}

export type { Props };

export { Link };
export type { Props as LinkProps };
