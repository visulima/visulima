/* eslint-disable consistent-return, sonarjs/pseudo-random */
import { useContext, useEffect, useMemo } from "react";

import FocusContext from "../../components/focus-context";
import useStdin from "./use-stdin";

type Input = {
    /**
     * Auto-focus this component if there's no active (focused) component right now.
     */
    autoFocus?: boolean;

    /**
     * Assign an ID to this component, so it can be programmatically focused with `focus(id)`.
     */
    id?: string;

    /**
     * Enable or disable this component's focus, while still maintaining its position in the list of focusable components.
     */
    isActive?: boolean;
};

type Output = {
    /**
     * Allows focusing a specific element with the provided `id`.
     */
    focus: (id: string) => void;

    /**
     * Determines whether this component is focused.
     */
    isFocused: boolean;
};

/**
 * A React hook that returns focus state and focus controls for the current component.
 * A component that uses the `useFocus` hook becomes "focusable" to Ink, so when the user presses &lt;kbd>Tab&lt;/kbd>, Ink will switch focus to this component. If there are multiple components that execute the `useFocus` hook, focus will be given to them in the order in which these components are rendered.
 */
const useFocus = ({ autoFocus = false, id: customId, isActive = true }: Input = {}): Output => {
    const { isRawModeSupported, setRawMode } = useStdin();
    const { activate, activeId, add, deactivate, focus, remove } = useContext(FocusContext);

    const id = useMemo(() => customId ?? Math.random().toString().slice(2, 7), [customId]);

    useEffect(() => {
        add(id, { autoFocus });

        return () => {
            remove(id);
        };
    }, [id, autoFocus]);

    useEffect(() => {
        if (isActive) {
            activate(id);
        } else {
            deactivate(id);
        }
    }, [isActive, id]);

    useEffect(() => {
        if (!isRawModeSupported || !isActive) {
            return;
        }

        setRawMode(true);

        return () => {
            setRawMode(false);
        };
    }, [isActive]);

    return {
        focus,
        isFocused: Boolean(id) && activeId === id,
    };
};

export default useFocus;

export { useFocus };
