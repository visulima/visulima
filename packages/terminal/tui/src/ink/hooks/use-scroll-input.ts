import useFocus from "./use-focus";
import useInput from "./use-input";

export type UseScrollInputOptions = {
    /**
     * Returns the current viewport height in lines. Called on each key event
     * so the value is always fresh (avoids stale-closure issues with refs).
     */
    getViewportHeight: () => number;

    /**
     * Enable or disable scroll input handling.
     * @default true
     */
    isActive?: boolean;

    /**
     * Scroll by a relative delta (in lines).
     */
    scrollBy: (delta: number) => void;

    /**
     * Jump to the bottom of the content.
     */
    scrollToBottom: () => void;

    /**
     * Jump to the top of the content.
     */
    scrollToTop: () => void;

    /**
     * Enable vim-style keybindings (j/k/g/G/u/d).
     * @default false
     */
    vimBindings?: boolean;
};

export type UseScrollInputReturn = {
    isFocused: boolean;
};

const useScrollInput = (options: UseScrollInputOptions): UseScrollInputReturn => {
    const { getViewportHeight, isActive = true, scrollBy, scrollToBottom, scrollToTop, vimBindings = false } = options;

    const { isFocused } = useFocus({ isActive });

    useInput(
        (input, key) => {
            // Arrow keys
            if (key.upArrow) {
                scrollBy(-1);

                return;
            }

            if (key.downArrow) {
                scrollBy(1);

                return;
            }

            // Page Up/Down
            if (key.pageUp) {
                scrollBy(-getViewportHeight());

                return;
            }

            if (key.pageDown) {
                scrollBy(getViewportHeight());

                return;
            }

            // Home/End
            if (key.home) {
                scrollToTop();

                return;
            }

            if (key.end) {
                scrollToBottom();

                return;
            }

            // Ctrl+U / Ctrl+D — half-page scroll
            if (key.ctrl && input === "u") {
                scrollBy(-Math.floor(getViewportHeight() / 2));

                return;
            }

            if (key.ctrl && input === "d") {
                scrollBy(Math.floor(getViewportHeight() / 2));

                return;
            }

            // Vim bindings
            if (vimBindings) {
                if (input === "k") {
                    scrollBy(-1);

                    return;
                }

                if (input === "j") {
                    scrollBy(1);

                    return;
                }

                if (input === "G" && key.shift) {
                    scrollToBottom();

                    return;
                }

                if (input === "g" && !key.shift) {
                    scrollToTop();

                    return;
                }

                if (input === "u" && !key.ctrl) {
                    scrollBy(-Math.floor(getViewportHeight() / 2));

                    return;
                }

                if (input === "d" && !key.ctrl) {
                    scrollBy(Math.floor(getViewportHeight() / 2));
                }
            }
        },
        { isActive },
    );

    return { isFocused };
};

export default useScrollInput;

export { useScrollInput };
