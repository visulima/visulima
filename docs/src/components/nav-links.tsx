import cn from "clsx";
import { ArrowRightIcon } from "nextra/icons";
import React, { ReactElement } from "react";

import { useConfig } from "../contexts";
import type { Item } from "../utils";
import Anchor from "./anchor";
import type { DocsThemeConfig } from "../theme";

interface NavLinkProperties {
    currentIndex: number;
    flatDirectories: Item[];
}

const classes = {
    link: cn(
        // eslint-disable-next-line max-len
        "flex max-w-[50%] items-center gap-1 py-4 text-base font-medium text-gray-600 transition-colors [word-break:break-word] hover:text-primary-500 dark:text-gray-300 md:text-lg",
    ),
    icon: cn("inline h-5 shrink-0"),
};

const NavLinks = ({ flatDirectories, currentIndex }: NavLinkProperties): ReactElement | null => {
    const config = useConfig();
    const nav = config.navigation;
    const navigation: Exclude<DocsThemeConfig["navigation"], boolean> = typeof nav === "boolean" ? { prev: nav, next: nav } : nav;
    const previous = navigation.prev && flatDirectories[currentIndex - 1];
    const next = navigation.next && flatDirectories[currentIndex + 1];

    if (!previous && !next) {
        return null;
    }

    return (
        <div
            className={cn(
                "mb-8 flex items-center border-t pt-8 dark:border-neutral-800",
                "contrast-more:border-neutral-400 dark:contrast-more:border-neutral-400",
            )}
        >
            {previous && (
                <Anchor href={previous.route} title={previous.title} className={cn(classes.link, "ltr:pr-4 rtl:pl-4", "flex-grow mr-4 border border-solid dark:border-primary-100/10 transition-all hover:-translate-y-1")}>
                    <ArrowRightIcon className={cn(classes.icon, "ltr:rotate-180 ml-4")} />
                    <div className="flex flex-col items-end flex-grow">
                        <span className="text-xs">
                            Previous
                        </span>
                        <span>
                            {previous.title}
                        </span>
                    </div>
                </Anchor>
            )}
            {next && (
                <Anchor
                    href={next.route}
                    title={next.title}
                    className={cn(classes.link, "ltr:ml-auto ltr:pl-4 ltr:text-right rtl:mr-auto rtl:pr-4 rtl:text-left", "flex-grow ml-4 border border-solid dark:border-primary-100/10 transition-all hover:-translate-y-1")}
                >
                    <div className="flex flex-col items-start flex-grow">
                        <span className="text-xs">
                            Next
                        </span>
                        <span>
                            {next.title}
                        </span>
                    </div>
                    <ArrowRightIcon className={cn(classes.icon, "rtl:rotate-180 mr-4")} />
                </Anchor>
            )}
        </div>
    );
};

export default NavLinks;
