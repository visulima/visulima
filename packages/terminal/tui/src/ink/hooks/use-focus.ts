/* eslint-disable consistent-return */
import { useContext, useEffect, useId } from "react";

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

    const generatedId = useId();
    const id = customId ?? generatedId;
    // Identifies this hook instance among the components that share an ID, so one of them switching to
    // inactive does not take the shared Tab stop away from the others.
    const holder = useId();

    useEffect(() => {
        add(id, { autoFocus });

        return () => {
            remove(id, holder);
        };
    }, [id, autoFocus]);

    useEffect(() => {
        if (isActive) {
            activate(id, holder);
        } else {
            deactivate(id, holder);
        }
    }, [isActive, id, holder]);

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
        isFocused: activeId === id,
    };
};

export default useFocus;

export { useFocus };
