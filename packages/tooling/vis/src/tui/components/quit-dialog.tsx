import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Dialog } from "@visulima/tui-kit/dialog";
import { useCallback, useEffect, useRef, useState } from "react";

interface QuitDialogProps {
    /** Countdown seconds. 0 = no auto-exit. */
    readonly autoExitSeconds: number;
    /** Called when the user cancels (any key except q). */
    readonly onCancel: () => void;
    /** Whether the dialog is visible. */
    readonly visible: boolean;
}

/**
 * Reusable quit confirmation dialog with countdown timer.
 * Shows a countdown, then auto-exits. Any key cancels the countdown.
 * Press q to exit immediately.
 */
const QuitDialog = ({ autoExitSeconds, onCancel, visible }: QuitDialogProps): React.JSX.Element | null => {
    const { exit } = useApp();
    const [countdown, setCountdown] = useState(autoExitSeconds || 3);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const openedAtRef = useRef(0);

    useEffect(() => {
        if (!visible) {
            return undefined;
        }

        const start = autoExitSeconds || 3;

        setCountdown(start);
        openedAtRef.current = Date.now();

        let remaining = start;

        timerRef.current = setInterval(() => {
            remaining -= 1;

            if (remaining <= 0) {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                setCountdown(0);
                exit();
            } else {
                setCountdown(remaining);
            }
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [visible, autoExitSeconds, exit]);

    const handleCancel = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        onCancel();
    }, [onCancel]);

    useInput(
        (input, _key) => {
            // Debounce the `q` that opened the dialog
            if (Date.now() - openedAtRef.current < 200) {
                return;
            }

            if (input === "q") {
                exit();
            } else {
                handleCancel();
            }
        },
        { isActive: visible },
    );

    return (
        <Dialog
            backgroundColor="#1e1e1e"
            footer={(
                <Text dimColor>
                    Press
{" "}
                    <Text bold color="white">
                        q
                    </Text>
{" "}
                    to exit,
{" "}
                    <Text bold color="white">
                        any key
                    </Text>
{" "}
                    to stay
                </Text>
              )}
            title={`Exiting in ${countdown}…`}
            visible={visible}
            width={50}
        >
            <Text dimColor>Stay to explore the results interactively.</Text>
        </Dialog>
    );
};

export default QuitDialog;
