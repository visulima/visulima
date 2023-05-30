import cn from "clsx";
import type { Heading } from "nextra";
import { ArrowRightIcon } from "nextra/icons";
import type { FC } from "react";
import { useMemo, useRef } from "react";

import { useConfig } from "../../contexts";
import type { ActiveAnchor } from "../../contexts/active-anchor";
import { renderComponent } from "../../utils";

const Toc: FC<TOCProperties> = ({
    headings, activeAnchor, isPage = false, prefix = "",
}) => {
    const config = useConfig();
    const tocReference = useRef<HTMLDivElement>(null);

    const items = useMemo(() => headings.filter((heading) => heading.depth > 1), [headings]);
    const hasHeadings = items.length > 0;

    const tocConfig = prefix === "sidebar" ? config.tocSidebar : config.tocContent;

    if (hasHeadings) {
        return (
            <div ref={tocReference}>
                {/* eslint-disable-next-line max-len */}
                <p className="mb-2 font-semibold uppercase tracking-wide text-gray-500 contrast-more:text-gray-800 dark:text-gray-400 contrast-more:dark:text-gray-50">
                    {renderComponent(config.tocSidebar.title)}
                </p>
                <ul className="leading-normal" key={prefix}>
                    {items.map(({ id, value, depth }) => (
                        <li className="group" key={`${prefix}${id}`}>
                            <a
                                href={`#${id}`}
                                className={cn(
                                    isPage
                                        ? {
                                            2: "font-semibold",
                                            3: "ltr:pl-4 rtl:pr-4",
                                            4: "ltr:pl-8 rtl:pr-8",
                                            5: "ltr:pl-12 rtl:pr-12",
                                            6: "ltr:pl-16 rtl:pr-16",
                                        }[depth as Exclude<typeof depth, 1>]
                                        : {
                                            2: "font-semibold",
                                            3: "ltr:ml-4 rtl:mr-4",
                                            4: "ltr:ml-8 rtl:mr-8",
                                            5: "ltr:ml-12 rtl:mr-12",
                                            6: "ltr:ml-16 rtl:mr-16",
                                        }[depth as Exclude<typeof depth, 1>],
                                    isPage
                                        ? "border-solid border-b dark:border-primary-100/10 contrast-more:border-neutral-400 py-2"
                                        : "my-2 scroll-my-6 scroll-py-6",
                                    isPage ? "flex justify-between items-center w-full" : "inline-block w-full",
                                    activeAnchor[id]?.isActive
                                        ? "text-primary-500 subpixel-antialiased contrast-more:!text-primary-500"
                                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300",
                                    "contrast-more:text-gray-900 contrast-more:underline contrast-more:dark:text-gray-50 w-full break-words",
                                )}
                            >
                                <span>
                                    {tocConfig.headingComponent?.({
                                        id,
                                        children: value,
                                    }) ?? value}
                                </span>
                                {isPage && (
                                    <span className="h-4 shrink-0 grow-0">
                                        <ArrowRightIcon className="block h-4 w-4" />
                                    </span>
                                )}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return null;
};

export type TOCProperties = {
    headings: Heading[];
    activeAnchor: ActiveAnchor;
    isPage?: boolean;
    prefix?: string;
};

export default Toc;
