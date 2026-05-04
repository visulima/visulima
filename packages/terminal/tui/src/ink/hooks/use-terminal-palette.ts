/* eslint-disable @typescript-eslint/no-unnecessary-condition, consistent-return, no-restricted-syntax, no-void, unicorn/no-null */

/**
 * React hook for terminal palette auto-detection.
 */
import { useEffect, useMemo, useState } from "react";

import type { TerminalPalette } from "../terminal-palette";
import { isTerminalPaletteQuerySupported, queryTerminalPalette } from "../terminal-palette";
import { useStdinContext } from "./use-stdin";
import useStdout from "./use-stdout";

export type UseTerminalPaletteResult = {
    readonly isLoading: boolean;
    readonly isSupported: boolean;
    readonly palette: Partial<TerminalPalette> | null;
};

/**
 * Hook that queries the terminal for its current color palette.
 * Returns the detected palette colors or null if not yet loaded.
 *
 * ```tsx
 * const { palette, isLoading } = useTerminalPalette();
 * if (palette?.background) {
 *     console.log("Terminal background:", palette.background);
 * }
 * ```
 */
const useTerminalPalette = (): UseTerminalPaletteResult => {
    const { stdin } = useStdinContext();
    const { stdout } = useStdout();
    const [palette, setPalette] = useState<Partial<TerminalPalette> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isSupported = useMemo(() => isTerminalPaletteQuerySupported(), []);

    useEffect(() => {
        if (!isSupported || !stdin || !stdout) {
            setIsLoading(false);

            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                const result = await queryTerminalPalette(stdin, stdout, 200);

                if (!cancelled) {
                    setPalette(result);
                }
            } catch {
                // Query failed — leave palette as null
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isSupported, stdin, stdout]);

    return { isLoading, isSupported, palette };
};

export default useTerminalPalette;
