import "intersection-observer";

import cn from "clsx";
import type { ComponentProps, FC, ReactElement } from "react";
import { useEffect, useRef } from "react";

import Anchor from "./components/anchor";
import Code from "./components/code";
import Details from "./components/details";
import Pre from "./components/pre";
import Summary from "./components/summary";
import Table from "./components/table";
import Td from "./components/td";
import Th from "./components/th";
import Tr from "./components/tr";
import Ul from "./components/ul";
import { useSetActiveAnchor } from "./contexts";
import { useIntersectionObserver, useSlugs } from "./contexts/active-anchor";
import type { DocumentationThemeConfig } from "./theme/theme-schema";

// Anchor links
// eslint-disable-next-line max-len
const createHeaderLink = (Tag: `h${2 | 3 | 4 | 5 | 6}`, context: { index: number }) => ({ children, id, ...properties }: ComponentProps<"h2">): ReactElement => {
    const setActiveAnchor = useSetActiveAnchor();
    const slugs = useSlugs();
    const observer = useIntersectionObserver();
    const obReference = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const heading = obReference.current;
        if (!heading) {
            return;
        }

        slugs.set(heading, [id, (context.index += 1)]);
        observer?.observe(heading);

        // eslint-disable-next-line consistent-return
        return () => {
            observer?.disconnect();
            slugs.delete(heading);

            setActiveAnchor((f) => {
                const returnValue = { ...f };

                if (id && id in returnValue) {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete returnValue[id];
                }

                return returnValue;
            });
        };
    }, [id, slugs, observer, setActiveAnchor]);

    return (
            <Tag
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
        ul: (properties: ComponentProps<"ul">) => <Ul {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        ol: (properties: ComponentProps<"ol">) => <ol className="mt-5 list-decimal first:mt-0 ltr:ml-6 rtl:mr-6" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        li: (properties: ComponentProps<"li">) => <li className="nested-list my-2" {...properties} />,
        blockquote: (properties: ComponentProps<"blockquote">) => (
            <blockquote
                className={cn(
                    "mt-5 border-gray-300 italic text-gray-700 dark:border-darker-700 dark:text-gray-400",
                    "first:mt-0 ltr:border-l-2 ltr:pl-6 rtl:border-r-2 rtl:pr-6",
                )}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            />
        ),
        // eslint-disable-next-line react/jsx-props-no-spreading
        hr: (properties: ComponentProps<"hr">) => <hr className="my-8 dark:border-gray-900" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        a: (properties) => <A {...properties} className="text-primary-500 underline decoration-from-font [text-underline-position:from-font]" />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        table: (properties: ComponentProps<"table">) => <Table className="nextra-scrollbar mt-5 p-0 first:mt-0" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        p: (properties: ComponentProps<"p">) => <p {...properties} />,
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
