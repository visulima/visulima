import { ChevronRightIcon } from "@heroicons/react/24/outline";
import cn from "clsx";
import Slugger from "github-slugger";
import type { Heading } from "nextra";
import type { FC } from "react";
import { useMemo, useRef } from "react";

import { useConfig } from "../../contexts";
import type { ActiveAnchor } from "../../contexts/active-anchor";
import { getHeadingText, renderComponent } from "../../utils";

const Toc: FC<TOCProperties> = ({ headings, activeAnchor, isPage = false }) => {
    const config = useConfig();
    const tocReference = useRef<HTMLDivElement>(null);

    const items = useMemo<{ text: string; slug: string; depth: 2 | 3 | 4 | 5 | 6 }[]>(() => {
        const slugger = new Slugger();

        return headings
            .filter((heading) => heading.type === "heading" && heading.depth > 1)
            .map((heading) => {
                const text = getHeadingText(heading);

                return {
                    text,
                    slug: (heading?.data?.id as string) || slugger.slug(text),
                    depth: heading.depth as any,
                };
            });
    }, [headings]);

    const hasHeadings = items.length > 0;

    if (hasHeadings) {
        return (
            <div ref={tocReference}>
                {/* eslint-disable-next-line max-len */}
                <p className="text-gray-500 dark:text-gray-400 contrast-more:text-gray-800 contrast-more:dark:text-gray-50 uppercase mb-2 font-semibold tracking-wide">
                    {renderComponent(config.tocSidebar.title)}
                </p>
                <ul className="leading-normal">
                    {items.map(({ slug, text, depth }) => (
                        <li className="group" key={slug}>
                            <a
                                href={`#${slug}`}
                                className={cn(
                                    {
                                        2: "font-medium",
                                        3: "ltr:ml-4 rtl:mr-4",
                                        4: "ltr:ml-8 rtl:mr-8",
                                        5: "ltr:ml-12 rtl:mr-12",
                                        6: "ltr:ml-16 rtl:mr-16",
                                    }[depth],
                                    isPage
                                        ? "border-solid border-b dark:border-primary-100/10 contrast-more:border-neutral-400 py-2"
                                        : "my-2 scroll-my-6 scroll-py-6",
                                    isPage ? "flex justify-between items-center w-full" : "inline-block w-full",
                                    activeAnchor[slug]?.isActive
                                        ? "text-primary-500 subpixel-antialiased contrast-more:!text-primary-500"
                                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300",
                                    "contrast-more:text-gray-900 contrast-more:underline contrast-more:dark:text-gray-50",
                                )}
                            >
                                <span>{text}</span>
                                {isPage && (
                                    <span className="flex-grow-0 flex-shrink-0 h-4">
                                        <ChevronRightIcon className="block h-full h-4 w-4" />
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
};

export default Toc;
