import type {
    Dispatch, ReactElement, ReactNode, SetStateAction,
} from "react";
import { createContext, useContext, useState } from "react";

const ActiveAnchorContext = createContext<ActiveAnchor>({});
const SetActiveAnchorContext = createContext<Dispatch<SetStateAction<ActiveAnchor>>>((v) => v);

export type ActiveAnchorItem = {
    isActive?: boolean;
    aboveHalfViewport: boolean;
    index: number;
    insideHalfViewport: boolean;
};
export type ActiveAnchor = Record<string, ActiveAnchorItem>;

// Separate the state as 2 contexts here to avoid
// re-renders of the content triggered by the state update.
export const useActiveAnchor = () => useContext(ActiveAnchorContext);
export const useSetActiveAnchor = () => useContext(SetActiveAnchorContext);

export const ActiveAnchorProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const [activeAnchor, setActiveAnchor] = useState<ActiveAnchor>({});

    return (
        <ActiveAnchorContext.Provider value={activeAnchor}>
            <SetActiveAnchorContext.Provider value={setActiveAnchor}>{children}</SetActiveAnchorContext.Provider>
        </ActiveAnchorContext.Provider>
    );
};
