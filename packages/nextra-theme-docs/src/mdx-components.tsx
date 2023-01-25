import "intersection-observer";

import cn from "clsx";
import {
    Table, Td, Th, Tr,
} from "nextra/components";
import type {
    ComponentProps, FC, ReactElement,
} from "react";
import {
    useEffect, useRef,
} from "react";

import Anchor from "./components/anchor";
import Code from "./components/code";
import Details from "./components/details";
import Pre from "./components/pre";
import Summary from "./components/summary";
import { IS_BROWSER } from "./constants";
import { useSetActiveAnchor } from "./contexts";
import type { ActiveAnchorItem } from "./contexts/active-anchor";
import type { DocumentationThemeConfig } from "./types";

let observer: IntersectionObserver;
let setActiveAnchor: ReturnType<typeof useSetActiveAnchor>;
const slugs = new WeakMap();

if (IS_BROWSER) {
    observer ||= new IntersectionObserver(
        (entries) => {
            // eslint-disable-next-line radar/cognitive-complexity
            setActiveAnchor((f) => {
                const returnValue = { ...f };

                entries.forEach((entry) => {
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
                });

                let activeSlug = "";
                let smallestIndexInViewport = Number.POSITIVE_INFINITY;
                let largestIndexAboveViewport = -1;

                Object.keys(returnValue).forEach((s) => {
                    (returnValue[s] as ActiveAnchorItem).isActive = false;

                    if ((returnValue[s] as ActiveAnchorItem).insideHalfViewport && (returnValue[s] as ActiveAnchorItem).index < smallestIndexInViewport) {
                        smallestIndexInViewport = (returnValue[s] as ActiveAnchorItem).index;
                        activeSlug = s;
                    }

                    if (
                        smallestIndexInViewport === Number.POSITIVE_INFINITY
                        && (returnValue[s] as ActiveAnchorItem).aboveHalfViewport
                        && (returnValue[s] as ActiveAnchorItem).index > largestIndexAboveViewport
                    ) {
                        largestIndexAboveViewport = (returnValue[s] as ActiveAnchorItem).index;
                        activeSlug = s;
                    }
                });

                if (returnValue[activeSlug]) {
                    (returnValue[activeSlug] as ActiveAnchorItem).isActive = true;
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

// Anchor links
// eslint-disable-next-line max-len
const createHeaderLink = (Tag: `h${2 | 3 | 4 | 5 | 6}`, context: { index: number }) => ({ children, id, ...properties }: ComponentProps<"h2">): ReactElement => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setActiveAnchor ??= useSetActiveAnchor();

    const obReference = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const heading = obReference.current;
        if (!heading) {
            return;
        }

        slugs.set(heading, [id, (context.index += 1)]);
        observer.observe(heading);

        // eslint-disable-next-line consistent-return
        return () => {
            observer.disconnect();
            slugs.delete(heading);

            setActiveAnchor((f) => {
                const returnValue = { ...f };
                delete returnValue[id!];
                return returnValue;
            });
        };
    }, [id]);

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
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            >
                {children}
                <span className="absolute -mt-20" id={id} ref={obReference} />
                {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
                <a href={`#${id}`} className="subheading-anchor" aria-label="Permalink for this section" />
            </Tag>
    );
};

// eslint-disable-next-line react/jsx-props-no-spreading
const A: FC<Omit<ComponentProps<"a">, "ref"> & { href?: string }> = ({ href = "", ...properties }) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Anchor href={href} newWindow={href.startsWith("https://")} {...properties} />
);

const getComponents = ({
    isRawLayout,
    components,
}: {
    isRawLayout?: boolean;
    components?: DocumentationThemeConfig["components"];
}): DocumentationThemeConfig["components"] => {
    if (isRawLayout) {
        return { a: A };
    }

    const context = { index: 0 };

    return {
        // eslint-disable-next-line jsx-a11y/heading-has-content,react/jsx-props-no-spreading
        h1: (properties: ComponentProps<"h1">) => <h1 className="mt-2 text-4xl font-bold tracking-tight" {...properties} />,
        h2: createHeaderLink("h2", context),
        h3: createHeaderLink("h3", context),
        h4: createHeaderLink("h4", context),
        h5: createHeaderLink("h5", context),
        h6: createHeaderLink("h6", context),
        // eslint-disable-next-line react/jsx-props-no-spreading
        ul: (properties: ComponentProps<"ul">) => <ul className="mt-6 list-disc first:mt-0 ltr:ml-6 rtl:mr-6" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        ol: (properties: ComponentProps<"ol">) => <ol className="mt-6 list-decimal first:mt-0 ltr:ml-6 rtl:mr-6" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        li: (properties: ComponentProps<"li">) => <li className="my-2" {...properties} />,
        blockquote: (properties: ComponentProps<"blockquote">) => (
            <blockquote
                className={cn(
                    "mt-6 border-gray-300 italic text-gray-700 dark:border-darker-700 dark:text-gray-400",
                    "first:mt-0 ltr:border-l-2 ltr:pl-6 rtl:border-r-2 rtl:pr-6",
                )}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            />
        ),
        // eslint-disable-next-line react/jsx-props-no-spreading
        hr: (properties: ComponentProps<"hr">) => <hr className="my-8 dark:border-gray-900" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        a: (properties) => <A {...properties} className="text-primary-500 underline decoration-from-font [text-underline-position:under]" />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        table: (properties: ComponentProps<"table">) => <Table className="nextra-scrollbar mt-6 p-0 first:mt-0" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        p: (properties: ComponentProps<"p">) => <p className="mt-6 leading-7 first:mt-0" {...properties} />,
        tr: Tr,
        th: Th,
        td: Td,
        details: Details,
        summary: Summary,
        pre: Pre,
        code: Code,
        // eslint-disable-next-line react/jsx-props-no-spreading
        ...components,
    };
};

export default getComponents;
