import type { Context } from "react";
import { createContext } from "react";

export type Props = {
    readonly activate: (id: string) => void;
    readonly activeId?: string;
    readonly add: (id: string, options: { autoFocus: boolean }) => void;
    readonly deactivate: (id: string) => void;
    readonly disableFocus: () => void;
    readonly enableFocus: () => void;
    readonly focus: (id: string) => void;
    readonly focusNext: () => void;
    readonly focusPrevious: () => void;
    readonly remove: (id: string) => void;
};

const FocusContext: Context<Props> = createContext<Props>({
    activate() {},
    activeId: undefined,
    add() {},
    deactivate() {},
    disableFocus() {},
    enableFocus() {},
    focus() {},
    focusNext() {},
    focusPrevious() {},
    remove() {},
});

FocusContext.displayName = "InternalFocusContext";

export default FocusContext;
