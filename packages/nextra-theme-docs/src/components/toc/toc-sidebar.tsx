import type { Heading } from "nextra";
import type { FC } from "react";
import { useEffect, useMemo, useRef } from "react";
import scrollIntoView from "scroll-into-view-if-needed";

import { useActiveAnchor, useConfig } from "../../contexts";
import cn from "../../utils/cn";
import { renderComponent } from "../../utils/render";
import MetaInfo from "../meta-info";
import Toc from "./toc";

const TocSidebar: FC<TOCProperties> = ({ filePath, headings, isOnScreen = false, locale, route }) => {
    const config = useConfig();
    const activeAnchor = useActiveAnchor();
    const tocReference = useRef<HTMLDivElement | null>(null);

    const items = useMemo(() => headings.filter((heading) => heading.depth > 1), [headings]);

    const hasHeadings = items.length > 0;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const hasMetaInfo = Boolean(config.feedback.content || config.editLink.component || config.tocSidebar.extraContent);

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
                boundary: tocReference.current,
                inline: "center",
                scrollMode: "always",
            });
        }
    }, [activeSlug]);

    return (
        <div
            className={cn(
                "nextra-scrollbar sticky top-16 overflow-y-auto pt-8 text-sm [hyphens:auto]",
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
            <Toc activeAnchor={activeAnchor} headings={headings} prefix="sidebar" />

            {hasMetaInfo && (
                <div
                    className={cn(
                        hasHeadings && "mt-8 border-t pt-8",
                        "sticky bottom-0 flex flex-col items-start gap-2 pb-8 dark:border-neutral-800",
                        "contrast-more:border-t contrast-more:border-neutral-400 contrast-more:shadow-none contrast-more:dark:border-neutral-400",
                    )}
                >
                    <MetaInfo config={config} filePath={filePath} locale={locale} route={route} />

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
