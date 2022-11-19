import "intersection-observer";

import cn from "clsx";
import {
    Table, Td, Th, Tr,
} from "nextra/components";
import React, {
    Children, cloneElement, ComponentProps, ReactElement, ReactNode, useEffect, useRef, useState,
} from "react";

import Anchor from "./components/anchor";
import Collapse from "./components/collapse";
import { IS_BROWSER } from "./constants";
import { DetailsProvider, useDetails, useSetActiveAnchor } from "./contexts";
import type { DocsThemeConfig } from "./types";
import Pre from "./components/pre";
import Code from "./components/code";

let observer: IntersectionObserver;
let setActiveAnchor: ReturnType<typeof useSetActiveAnchor>;
const slugs = new WeakMap();

if (IS_BROWSER) {
    observer ||= new IntersectionObserver(
        (entries) => {
            setActiveAnchor((f) => {
                const returnValue = { ...f };

                for (const entry of entries) {
                    if (entry?.rootBounds && slugs.has(entry.target)) {
                        const [slug, index] = slugs.get(entry.target);
                        const aboveHalfViewport = entry.boundingClientRect.y + entry.boundingClientRect.height <= entry.rootBounds.y + entry.rootBounds.height;
                        const insideHalfViewport = entry.intersectionRatio > 0;
                        returnValue[slug] = {
                            index,
                            aboveHalfViewport,
                            insideHalfViewport,
                        };
                    }
                }

                let activeSlug = "";
                let smallestIndexInViewport = Number.POSITIVE_INFINITY;
                let largestIndexAboveViewport = -1;
                for (const s in returnValue) {
                    returnValue[s].isActive = false;
                    if (returnValue[s].insideHalfViewport && returnValue[s].index < smallestIndexInViewport) {
                        smallestIndexInViewport = returnValue[s].index;
                        activeSlug = s;
                    }
                    if (smallestIndexInViewport === Number.POSITIVE_INFINITY && returnValue[s].aboveHalfViewport && returnValue[s].index > largestIndexAboveViewport) {
                        largestIndexAboveViewport = returnValue[s].index;
                        activeSlug = s;
                    }
                }

                if (returnValue[activeSlug]) returnValue[activeSlug].isActive = true;
                return returnValue;
            });
        },
        {
            rootMargin: "0px 0px -50%",
            threshold: [0, 1],
        },
    );
}

// Anchor links
const createHeaderLink = (Tag: `h${2 | 3 | 4 | 5 | 6}`, context: { index: number }) => function HeaderLink({ children, id, ...properties }: ComponentProps<"h2">): ReactElement {
    setActiveAnchor ??= useSetActiveAnchor();
    const obReference = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const heading = obReference.current;
        if (!heading) return;

        slugs.set(heading, [id, (context.index += 1)]);
        observer.observe(heading);

        return () => {
            observer.disconnect();
            slugs.delete(heading);
            setActiveAnchor((f) => {
                const returnValue = { ...f };
                delete returnValue[id!];
                return returnValue;
            });
        };
    }, []);

    return (
            <Tag
                className={cn(
                    "font-semibold tracking-tight",
                    {
                        h2: "mt-10 border-b pb-1 text-3xl contrast-more:border-neutral-400 dark:border-primary-100/10 contrast-more:dark:border-neutral-400",
                        h3: "mt-8 text-2xl",
                        h4: "mt-8 text-xl",
                        h5: "mt-8 text-lg",
                        h6: "mt-8 text-base",
                    }[Tag],
                )}
                {...properties}
            >
                {children}
                <span className="absolute -mt-20" id={id} ref={obReference} />
                <a href={`#${id}`} className="subheading-anchor" />
            </Tag>
    );
};

const findSummary = (children: ReactNode) => {
    let summary: ReactNode = null;
    const restChildren: ReactNode[] = [];

    Children.forEach(children, (child, index) => {
        if (child && (child as ReactElement).type === Summary) {
            summary ||= child;
            return;
        }

        let c = child;
        if (!summary && child && typeof child === "object" && (child as ReactElement).type !== Details && "props" in child && child.props) {
            const result = findSummary(child.props.children);
            summary = result[0];
            c = cloneElement(child, {
                ...child.props,
                children: result[1]?.length ? result[1] : undefined,
                key: index,
            });
        }
        restChildren.push(c);
    });

    return [summary, restChildren];
};

const Details = ({ children, open, ...properties }: ComponentProps<"details">): ReactElement => {
    const [openState, setOpen] = useState(!!open);
    const [summary, restChildren] = findSummary(children);

    // To animate the close animation we have to delay the DOM node state here.
    const [delayedOpenState, setDelayedOpenState] = useState(openState);
    useEffect(() => {
        if (openState) {
            setDelayedOpenState(true);
        } else {
            const timeout = setTimeout(() => setDelayedOpenState(openState), 500);
            return () => clearTimeout(timeout);
        }
    }, [openState]);

    return (
        <details
            className="my-4 rounded border border-gray-200 bg-white p-2 shadow-sm first:mt-0 dark:border-neutral-800 dark:bg-neutral-900"
            {...properties}
            open={delayedOpenState}
            {...(openState && { "data-expanded": true })}
        >
            <DetailsProvider value={setOpen}>{summary}</DetailsProvider>
            <Collapse open={openState}>{restChildren}</Collapse>
        </details>
    );
};

const Summary = (properties: ComponentProps<"summary">): ReactElement => {
    const setOpen = useDetails();
    return (
        <summary
            className={cn(
                "cursor-pointer list-none p-1 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800",
                "before:mr-1 before:inline-block before:transition-transform before:content-[''] dark:before:invert",
                "rtl:before:rotate-180 [[data-expanded]>&]:before:rotate-90",
            )}
            {...properties}
            onClick={(e) => {
                e.preventDefault();
                setOpen((v) => !v);
            }}
        />
    );
};

const A = ({ href = "", ...properties }) => <Anchor href={href} newWindow={href.startsWith("https://")} {...properties} />;

export const getComponents = ({
    isRawLayout,
    components,
}: {
    isRawLayout?: boolean;
    components?: DocsThemeConfig["components"];
}): DocsThemeConfig["components"] => {
    if (isRawLayout) {
        return { a: A };
    }

    const context = { index: 0 };

    return {
        h1: (properties: ComponentProps<"h1">) => <h1 className="mt-2 text-4xl font-bold tracking-tight" {...properties} />,
        h2: createHeaderLink("h2", context),
        h3: createHeaderLink("h3", context),
        h4: createHeaderLink("h4", context),
        h5: createHeaderLink("h5", context),
        h6: createHeaderLink("h6", context),
        ul: (properties: ComponentProps<"ul">) => <ul className="mt-6 list-disc first:mt-0 ltr:ml-6 rtl:mr-6" {...properties} />,
        ol: (properties: ComponentProps<"ol">) => <ol className="mt-6 list-decimal first:mt-0 ltr:ml-6 rtl:mr-6" {...properties} />,
        li: (properties: ComponentProps<"li">) => <li className="my-2" {...properties} />,
        blockquote: (properties: ComponentProps<"blockquote">) => (
            <blockquote
                className={cn(
                    "mt-6 border-gray-300 italic text-gray-700 dark:border-gray-700 dark:text-gray-400",
                    "first:mt-0 ltr:border-l-2 ltr:pl-6 rtl:border-r-2 rtl:pr-6",
                )}
                {...properties}
            />
        ),
        hr: (properties: ComponentProps<"hr">) => <hr className="my-8 dark:border-gray-900" {...properties} />,
        a: (properties) => <A {...properties} className="text-primary-500 underline decoration-from-font [text-underline-position:under]" />,
        table: (properties: ComponentProps<"table">) => <Table className="nextra-scrollbar mt-6 p-0 first:mt-0" {...properties} />,
        p: (properties: ComponentProps<"p">) => <p className="mt-6 leading-7 first:mt-0" {...properties} />,
        tr: Tr,
        th: Th,
        td: Td,
        details: Details,
        summary: Summary,
        pre: Pre,
        code: Code,
        ...components,
    };
};
