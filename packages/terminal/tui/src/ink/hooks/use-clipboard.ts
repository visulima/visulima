/* eslint-disable @typescript-eslint/no-unnecessary-condition, no-restricted-syntax */

/**
 * React hook for clipboard operations via OSC 52 terminal escape sequences.
 */
import { useCallback, useMemo } from "react";

import type { ClipboardTarget } from "../clipboard";
import { isOsc52Supported, writeOsc52 } from "../clipboard";
import useStdout from "./use-stdout";

export type UseClipboardOptions = {
    /**
     * The clipboard target to write to.
     * @default "c"
     */
    readonly target?: ClipboardTarget;
};

export type UseClipboardResult = {
    /**
     * Copy text to the system clipboard.
     * No-op if the terminal does not support OSC 52.
     */
    readonly copy: (text: string) => void;

    /**
     * Whether the current terminal supports OSC 52 clipboard operations.
     */
    readonly isSupported: boolean;
};

/**
 * Hook that provides clipboard write access via OSC 52.
 *
 * ```tsx
 * const { copy, isSupported } = useClipboard();
 * copy("Hello, clipboard!");
 * ```
 */
const useClipboard = (options: UseClipboardOptions = {}): UseClipboardResult => {
    const { target = "c" } = options;
    const { stdout } = useStdout();

    const isSupported = useMemo(() => isOsc52Supported(), []);

    const copy = useCallback(
        (text: string) => {
            if (!isSupported || !stdout) {
                return;
            }

            writeOsc52(stdout, text, target);
        },
        [isSupported, stdout, target],
    );

    return useMemo(() => {
        return { copy, isSupported };
    }, [copy, isSupported]);
};

export default useClipboard;

export { useClipboard };
