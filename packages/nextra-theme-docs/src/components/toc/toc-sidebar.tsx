import cn from "clsx";
import type { Heading } from "nextra";
import type { FC } from "react";
import React, { useEffect, useRef } from "react";
import scrollIntoView from "scroll-into-view-if-needed";

import { useActiveAnchor, useConfig } from "../../contexts";
import { getGitIssueUrl, renderComponent } from "../../utils";
import Anchor from "../anchor";
import Toc from "./toc";

const TocSidebar: FC<TOCProperties> = ({
    headings, filePath, isOnScreen = false, locale,
}) => {
    const config = useConfig();
    const activeAnchor = useActiveAnchor();
    const tocReference = useRef<HTMLDivElement>(null);

    const hasHeadings = headings.some((heading) => heading.type === "heading" && heading.depth > 1);
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
                "transition-all duration-200",
                isOnScreen ? "!opacity-100 !visibility" : "pointer-events-none opacity-0 visibility-hidden",
            )}
        >
            <Toc headings={headings} activeAnchor={activeAnchor} />

            {hasMetaInfo && (
                <div
                    className={cn(
                        hasHeadings && "mt-8 border-t pt-8",
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
                        children: renderComponent(config.editLink.text, { locale }),
                    })}

                    {renderComponent(config.tocSidebar.extraContent)}
                </div>
            )}
        </div>
    );
};

export type TOCProperties = {
    headings: Heading[];
    filePath: string;
    isOnScreen?: boolean;
    locale: string;
};

export default TocSidebar;
