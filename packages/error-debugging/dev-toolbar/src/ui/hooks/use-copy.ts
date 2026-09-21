import { useEffect, useRef, useState } from "preact/hooks";

/** How long the confirmation stays up after a successful copy. */
const FLASH_MS = 1500;

/**
 * Clipboard write with a timed confirmation flag.
 *
 * `copied` turns true only once the write resolves — a rejected write (no
 * permission, insecure context) leaves it false rather than claiming success.
 * The pending reset is cleared on a repeat copy and on unmount.
 */
export const useCopy = (): { copied: boolean; copy: (text: string) => void } => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(
        () => () => {
            clearTimeout(timer.current);
        },
        [],
    );

    const copy = (text: string): void => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                clearTimeout(timer.current);
                setCopied(true);
                timer.current = setTimeout(setCopied, FLASH_MS, false);

                return undefined;
            })
            .catch(() => {
                /* clipboard unavailable — leave the flag false */
            });
    };

    return { copied, copy };
};
