import type { Heading } from "nextra/types";
import type { FC } from "react";
import { useEffect, useRef } from "react";
import scrollIntoView from "scroll-into-view-if-needed";

import { useActiveAnchor, useConfig } from "../../contexts";
import cn from "../../utils/cn";
import { renderComponent } from "../../utils/render";
import MetaInfo from "../meta-info";
import Toc from "./toc";

const TocSidebar: FC<TOCProperties> = ({ filePath, headings, isOnScreen = false, locale, route }) => {
    const config = useConfig();
    const activeId = useActiveAnchor();
    const tocReference = useRef<HTMLDivElement | null>(null);

    const hasHeadings = headings.length > 0;
    const activeIndex = headings.findIndex(({ id }) => id === activeId);
    const hasMetaInfo = Boolean(config.feedback.content || config.editLink.component || config.tocSidebar.extraContent);

    useEffect(() => {
        if (!activeId) {
            return;
        }

        const anchor = tocReference.current?.querySelector(`li > a[href="#${activeId}"]`);

        if (anchor) {
            scrollIntoView(anchor, {
                behavior: "smooth",
                block: "center",
                boundary: tocReference.current,
                inline: "center",
                scrollMode: "always",
            });
        }
    }, [activeId]);

    return (
        <div
            className={cn(
                "nextra-scrollbar lg:sticky overflow-y-auto pt-8 text-sm [hyphens:auto] top-[var(--nextra-navbar-height)]",
                "max-h-[calc(100vh-var(--nextra-navbar-height)-env(safe-area-inset-bottom))] ltr:-mr-4 rtl:-ml-4",
                "opacity-0",
                {
                    "opacity-100": isOnScreen,
                    "pointer-events-none": !isOnScreen,
                },
                "transition-all duration-200",
            )}
            ref={tocReference}
        >
            <Toc activeId={activeId} headings={headings} prefix="sidebar" />

            {hasMetaInfo && (
                <div
                    className={cn(
                        hasHeadings && "mt-8 border-t pt-8",
                        "sticky bottom-0 flex flex-col items-start gap-2 pb-8 dark:border-neutral-800",
                        "contrast-more:border-t contrast-more:border-neutral-400 contrast-more:shadow-none contrast-more:dark:border-neutral-400",
                        "bg-white dark:bg-darker-800",
                    )}
                >
                    <MetaInfo config={config} filePath={filePath} hidden={activeIndex < 2} locale={locale} route={route} />

                    {renderComponent(config.tocSidebar.extraContent)}
                </div>
            )}
        </div>
    );
};

export interface TOCProperties {
    filePath: string;
    headings: Heading[];
    isOnScreen?: boolean;
    locale: string;
    route: string;
}

export default TocSidebar;
