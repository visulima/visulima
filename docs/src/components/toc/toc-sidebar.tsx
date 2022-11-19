import cn from "clsx";
import type { Heading } from "nextra";
import type { ReactElement, MutableRefObject } from "react";
import React, { useRef, useEffect, useState } from "react";
import scrollIntoView from "scroll-into-view-if-needed";

import { useActiveAnchor, useConfig } from "../../contexts";
import { getGitIssueUrl, renderComponent } from "../../utils";
import Anchor from "../anchor";
import Toc from "./toc";

export type TOCProps = {
    headings: Heading[];
    filePath: string;
    isOnScreen?: boolean;
};

const TocSidebar = ({ headings, filePath, isOnScreen = true }: TOCProps): ReactElement => {
    const config = useConfig();
    const activeAnchor = useActiveAnchor();
    const tocReference = useRef<HTMLDivElement>(null);

    const hasHeadings = headings.filter((heading) => heading.type === "heading" && heading.depth > 1).length > 0;
    const hasMetaInfo = Boolean(config.feedback.content || config.editLink.component || config.tocSidebar.extraContent);

    const linkClassName = cn(
        "text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
        "contrast-more:text-gray-800 contrast-more:dark:text-gray-50",
    );

    const activeSlug = Object.entries(activeAnchor).find(([, { isActive }]) => isActive)?.[0];

    useEffect(() => {
        if (!activeSlug) {
            return;
        }

        const anchor = tocReference.current?.querySelector(`li > a[href="#${activeSlug}"]`);

        if (anchor) {
            scrollIntoView(anchor, {
                behavior: "smooth",
                block: "center",
                inline: "center",
                scrollMode: "always",
                boundary: tocReference.current,
            });
        }
    }, [activeSlug]);

    return (
        <div
            ref={tocReference}
            className={cn(
                "nextra-scrollbar sticky top-16 overflow-y-auto pr-4 pt-8 text-sm [hyphens:auto]",
                "max-h-[calc(100vh-var(--nextra-navbar-height)-env(safe-area-inset-bottom))] ltr:-mr-4 rtl:-ml-4",
                "transition-opacity duration-200 opacity-0",
                isOnScreen ? "!opacity-100" : ""
            )}
        >
            <Toc headings={headings} activeAnchor={activeAnchor} />

            {hasMetaInfo && (
                <div
                    className={cn(
                        hasHeadings && "mt-8 border-t bg-white pt-8 shadow-[0_-12px_16px_white] dark:bg-dark dark:shadow-[0_-12px_16px_#111]",
                        "sticky bottom-0 flex flex-col items-start gap-2 pb-8 dark:border-neutral-800",
                        "contrast-more:border-t contrast-more:border-neutral-400 contrast-more:shadow-none contrast-more:dark:border-neutral-400",
                    )}
                >
                    {config.feedback.content ? (
                        <Anchor
                            className={linkClassName}
                            href={getGitIssueUrl({
                                repository: config.docsRepositoryBase,
                                title: `Feedback for “${config.title}”`,
                                labels: config.feedback.labels,
                            })}
                            newWindow
                        >
                            {renderComponent(config.feedback.content)}
                        </Anchor>
                    ) : null}

                    {renderComponent(config.editLink.component, {
                        filePath,
                        className: linkClassName,
                        children: renderComponent(config.editLink.text),
                    })}

                    {renderComponent(config.tocSidebar.extraContent)}
                </div>
            )}
        </div>
    );
};

export default TocSidebar;
