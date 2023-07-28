import "intersection-observer";

import cn from "clsx";
import type { ComponentProps } from "react";

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
import type { DocumentationThemeConfig } from "./theme/theme-schema";
import createHeaderLink from "./utils/create-header-link";

const A = ({ className, href = "", ...properties }: Omit<ComponentProps<"a">, "ref"> & { href?: string }) => {
    const isExternal = href.startsWith("http://") || href.startsWith("https://");

    const externalClassNames = 'after:content-[""] after:w-3 after:h-3 after:bg-center after:bg-no-repeat after:bg-contain after:inline-block after:ml-1';

    return (
        <Anchor
            className={cn(className, {
                [externalClassNames]: isExternal,
            })}
            href={href}
            newWindow={isExternal}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
        />
    );
};

const getComponents = ({
    components,
    isRawLayout,
}: {
    components?: DocumentationThemeConfig["components"];
    isRawLayout?: boolean;
}): DocumentationThemeConfig["components"] => {
    if (isRawLayout) {
        return { a: A };
    }

    return {
        // eslint-disable-next-line react/jsx-props-no-spreading
        a: (properties) => <A {...properties} className="text-primary-500 underline decoration-from-font [text-underline-position:from-font]" />,
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
        code: Code,
        details: Details,
        // eslint-disable-next-line jsx-a11y/heading-has-content,react/jsx-props-no-spreading
        h1: (properties: ComponentProps<"h1">) => <h1 className="mt-2 text-4xl font-bold tracking-tight" {...properties} />,
        h2: createHeaderLink("h2"),
        h3: createHeaderLink("h3"),
        h4: createHeaderLink("h4"),
        h5: createHeaderLink("h5"),
        h6: createHeaderLink("h6"),
        // eslint-disable-next-line react/jsx-props-no-spreading
        hr: (properties: ComponentProps<"hr">) => <hr className="my-8 dark:border-gray-700" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        li: (properties: ComponentProps<"li">) => <li className="nested-list my-2" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        ol: (properties: ComponentProps<"ol">) => <ol className="mt-5 list-decimal first:mt-0 ltr:ml-6 rtl:mr-6" {...properties} />,
        // eslint-disable-next-line react/jsx-props-no-spreading
        p: (properties: ComponentProps<"p">) => <p {...properties} />,
        pre: Pre,
        summary: Summary,
        // eslint-disable-next-line react/jsx-props-no-spreading
        table: (properties: ComponentProps<"table">) => <Table className="nextra-scrollbar mt-5 p-0 first:mt-0" {...properties} />,
        td: Td,
        th: Th,
        tr: Tr,
        // eslint-disable-next-line react/jsx-props-no-spreading
        ul: (properties: ComponentProps<"ul">) => <Ul {...properties} />,

        ...components,
    };
};

export default getComponents;
