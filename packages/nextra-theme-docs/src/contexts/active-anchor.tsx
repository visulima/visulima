import type { ContextType, ReactElement, ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import "intersection-observer";

// Separate the state of 2 contexts to avoid re-renders of the content triggered
// by the state update
const ActiveAnchorContext = createContext("");
const ObserverContext = createContext<IntersectionObserver | null>(null);

export const useActiveAnchor: () => string = () => useContext(ActiveAnchorContext);
export const useObserver: () => IntersectionObserver | null = () => useContext(ObserverContext);

export const ActiveAnchorProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const [activeId, setActiveId] = useState("");
    const observerReference = useRef<ContextType<typeof ObserverContext>>(null);

    useEffect(() => {
        observerReference.current?.disconnect();

        // eslint-disable-next-line compat/compat
        observerReference.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.intersectionRatio > 0 && entry.isIntersecting) {
                        const id = entry.target.getAttribute("id");

                        if (id) {
                            setActiveId(id);
                        }
                    }
                });
            },
            { rootMargin: "0px 0px -80%" },
        );
        const observer = observerReference.current;

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <ObserverContext.Provider value={observerReference.current}>
            <ActiveAnchorContext.Provider value={activeId}>{children}</ActiveAnchorContext.Provider>
        </ObserverContext.Provider>
    );
};
