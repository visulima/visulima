import { useContext } from "react";

import type { Props } from "../../components/focus-context";
import FocusContext from "../../components/focus-context";

type Output = {
    /**
     * The ID of the currently focused component, or `undefined` if no component is focused.
     * @example
     * ```tsx
     * import {Text} from '@visulima/tui/components/text';
     * import {useFocusManager} from '@visulima/tui/hooks/use-focus-manager';
     *
     * const Example = () => {
     * const {activeId} = useFocusManager();
     *
     * return <Text>Focused: {activeId ?? 'none'}</Text>;
     * };
     * ```
     */
    activeId: Props["activeId"];

    /**
     * Disable focus management for all components. The currently active component (if there's one) will lose its focus.
     */
    disableFocus: Props["disableFocus"];

    /**
     * Enable focus management for all components.
     */
    enableFocus: Props["enableFocus"];

    /**
     * Switch focus to the element with provided `id`. If there's no element with that `id`, focus is not changed.
     */
    focus: Props["focus"];

    /**
     * Switch focus to the next focusable component. If there's no active component right now, focus will be given to the first focusable component. If the active component is the last in the list of focusable components, focus will be switched to the first focusable component.
     */
    focusNext: Props["focusNext"];

    /**
     * Switch focus to the previous focusable component. If there's no active component right now, focus will be given to the first focusable component. If the active component is the first in the list of focusable components, focus will be switched to the last focusable component.
     */
    focusPrevious: Props["focusPrevious"];
};

/**
 * A React hook that returns methods to enable or disable focus management for all components or manually switch focus to the next or previous components.
 */
const useFocusManager = (): Output => {
    const focusContext = useContext(FocusContext);

    return {
        activeId: focusContext.activeId,
        disableFocus: focusContext.disableFocus,
        enableFocus: focusContext.enableFocus,
        focus: focusContext.focus,
        focusNext: focusContext.focusNext,
        focusPrevious: focusContext.focusPrevious,
    };
};

export default useFocusManager;

export { useFocusManager };
