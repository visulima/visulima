import "intersection-observer";

import type {Dispatch, MutableRefObject, ReactElement, ReactNode, SetStateAction} from "react";
import { createContext, useContext, useRef, useState } from "react";

import { IS_BROWSER } from "../constants/base";

type Anchor = {
    isActive?: boolean;
    aboveHalfViewport: boolean;
    index: number;
    insideHalfViewport: boolean;
};

const ActiveAnchorContext = createContext<ActiveAnchor>({});
const SetActiveAnchorContext = createContext<Dispatch<SetStateAction<ActiveAnchor>>>((v) => v);

const IntersectionObserverContext = createContext<IntersectionObserver | null>(null);
const slugs = new WeakMap<HTMLAnchorElement, [string, number]>();
const SlugsContext = createContext<WeakMap<HTMLAnchorElement, [string, number]>>(slugs);

export const SlugCounterContext = createContext<MutableRefObject<number>>({ current: 0 });

export const useSlugCounter = (): MutableRefObject<number> => useContext(SlugCounterContext);

export type ActiveAnchor = Record<string, Anchor>;

// Separate the state as 2 contexts here to avoid
// re-renders of the content triggered by the state update.
export const useActiveAnchor = (): ActiveAnchor => useContext(ActiveAnchorContext);
export const useSetActiveAnchor = (): Dispatch<SetStateAction<ActiveAnchor>> => useContext(SetActiveAnchorContext);

export const useIntersectionObserver = (): IntersectionObserver | null => useContext(IntersectionObserverContext);
export const useSlugs = (): WeakMap<HTMLAnchorElement, [string, number]> => useContext(SlugsContext);

export const ActiveAnchorProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const [activeAnchor, setActiveAnchor] = useState<ActiveAnchor>({});
    const observerReference = useRef<IntersectionObserver | null>(null);

    if (IS_BROWSER && !observerReference.current) {
        observerReference.current = new IntersectionObserver(
            // eslint-disable-next-line sonarjs/cognitive-complexity
            (entries) => {
                setActiveAnchor((anchor) => {
                    const returnValue: ActiveAnchor = { ...anchor };

                    entries.forEach((entry) => {
                        if (entry.rootBounds && slugs.has(entry.target as HTMLAnchorElement)) {
                            const [slug, index] = slugs.get(entry.target as HTMLAnchorElement) as [string, number];

                            const aboveHalfViewport =
                                entry.boundingClientRect.y + entry.boundingClientRect.height <= entry.rootBounds.y + entry.rootBounds.height;
                            const insideHalfViewport = entry.intersectionRatio > 0;

                            returnValue[slug] = {
                                index,
                                aboveHalfViewport,
                                insideHalfViewport,
                            };
                        }
                    });

                    let activeSlug: keyof ActiveAnchor = "";
                    let smallestIndexInViewport = Number.POSITIVE_INFINITY;
                    let largestIndexAboveViewport = -1;

                    Object.entries(returnValue).forEach(([slug, returnValue_]) => {
                        // eslint-disable-next-line no-param-reassign
                        returnValue_.isActive = false;

                        if (returnValue_.insideHalfViewport && returnValue_.index < smallestIndexInViewport) {
                            smallestIndexInViewport = returnValue_.index;
                            activeSlug = slug;
                        }
                        if (
                            smallestIndexInViewport === Number.POSITIVE_INFINITY &&
                            returnValue_.aboveHalfViewport &&
                            returnValue_.index > largestIndexAboveViewport
                        ) {
                            largestIndexAboveViewport = returnValue_.index;
                            activeSlug = slug;
                        }
                    });

                    if (returnValue[activeSlug]) {
                        (returnValue[activeSlug] as Anchor).isActive = true;
                    }

                    return returnValue;
                });
            },
            {
                rootMargin: "0px 0px -50%",
                threshold: [0, 1],
            },
        );
    }

    return (
        <ActiveAnchorContext.Provider value={activeAnchor}>
            <SetActiveAnchorContext.Provider value={setActiveAnchor}>
                <SlugsContext.Provider value={slugs}>
                    <IntersectionObserverContext.Provider value={observerReference.current}>{children}</IntersectionObserverContext.Provider>
                </SlugsContext.Provider>
            </SetActiveAnchorContext.Provider>
        </ActiveAnchorContext.Provider>
    );
};
