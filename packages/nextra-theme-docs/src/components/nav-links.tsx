import cn from "clsx";
import { ArrowRightIcon } from "nextra/icons";
import type { FC } from "react";

import { useConfig } from "../contexts";
import type { DocumentationThemeConfig } from "../theme/theme-schema";
import type { DocsItem as DocumentationItem } from "../types";
import Anchor from "./anchor";

interface NavLinkProperties {
    currentIndex: number;
    flatDirectories: DocumentationItem[];
    layout?: string;
}

const classes = {
    icon: cn("inline h-5 shrink-0"),
    link: cn(
        "flex items-center gap-1 py-4 text-base font-medium text-gray-600 transition-colors [word-break:break-word] hover:text-primary-600 dark:text-gray-300 lg:text-lg",
    ),
};

const NavLinks: FC<NavLinkProperties> = ({ currentIndex, flatDirectories, layout = undefined }) => {
    const config = useConfig();
    const nav = config.navigation;
    const navigation: Exclude<DocumentationThemeConfig["navigation"], boolean> = typeof nav === "boolean" ? { next: nav, prev: nav } : nav;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    const previous: DocumentationItem | undefined = navigation.prev ? flatDirectories[currentIndex - 1] : undefined;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    const next: DocumentationItem | undefined = navigation.next ? flatDirectories[currentIndex + 1] : undefined;

    if (!previous && !next) {
        return null;
    }

    return (
        <div
            className={cn(
                "print:hidden",
                "flex lg:flex-row flex-col items-stretch border-t py-8 dark:border-neutral-800",
                "contrast-more:border-neutral-400 dark:contrast-more:border-neutral-400",
                layout === "full" && "mb-8",
            )}
        >
            {previous && (
                <Anchor
                    className={cn(
                        classes.link,
                        next ? "max-w-full lg:max-w-[50%] lg:mr-4" : "max-w-full",
                        "ltr:pr-4 rtl:pl-4",
                        "flex-grow border border-solid dark:border-primary-100/10 transition-all hover:-translate-y-1",
                    )}
                    href={previous.route}
                    title={previous.title}
                >
                    <ArrowRightIcon className={cn(classes.icon, "ltr:rotate-180 ml-4")} />
                    <div className="flex grow flex-col items-end">
                        <span className="text-xs">Previous</span>
                        <span>{previous.title}</span>
                    </div>
                </Anchor>
            )}
            {next && (
                <Anchor
                    className={cn(
                        classes.link,
                        previous ? "max-w-full lg:max-w-[50%] mt-4 lg:!mt-0" : "max-w-full",
                        "lg:ltr:ml-auto ltr:pl-4 ltr:text-right lg:rtl:mr-auto rtl:pr-4 rtl:text-left",
                        "flex-grow lg:ml-4 border border-solid dark:border-primary-100/10 transition-all hover:-translate-y-1",
                    )}
                    href={next.route}
                    title={next.title}
                >
                    <div className="flex grow flex-col items-start">
                        <span className="text-xs">Next</span>
                        <span>{next.title}</span>
                    </div>
                    <ArrowRightIcon className={cn(classes.icon, "rtl:rotate-180 mr-4")} />
                </Anchor>
            )}
        </div>
    );
};

export default NavLinks;
