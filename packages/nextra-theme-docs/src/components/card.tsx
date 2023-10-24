import type { LinkProps } from "next/link";
import Link from "next/link";
import type { FC, PropsWithChildren, ReactNode } from "react";

import cn from "../utils/cn";

interface CardBaseProperties {
    classes?: { content?: string; iconWrapper?: string; main?: string; title?: string };
    href: never;
    icon?: ReactNode;
    title: string;
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type CardLinkProperties = LinkProps & Omit<CardBaseProperties, "href"> & { href: string };

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type Properties = CardBaseProperties | CardLinkProperties;

const Card: FC<PropsWithChildren<Properties>> = ({ children = undefined, classes = undefined, href, icon, title, ...properties }) => {
    const wrapperClassName = cn(
        "nextra-card",
        "bg-transparent",
        "group block not-prose font-normal group relative my-2 ring-2 ring-transparent rounded-md",
        "border border-gray-100 transition-all duration-200",
        "shadow-md dark:shadow-none shadow-gray-300/10 overflow-hidden w-full",
        "dark:shadow-none dark:border-neutral-800 ",
        { "cursor-pointer hover:border-gray-600 dark:hover:shadow-none dark:hover:border-[#f5f5fa]": typeof href === "string" && href.length > 0 },
        classes?.main,
    );

    let content = (
        <div
            className={cn({
                "flex gap-2 p-4 text-gray-700 dark:text-neutral-200": children === undefined,
                "px-6 py-5": children !== undefined,
            })}
        >
            {icon && (
                <span
                    className={cn(
                        "nextra-card-icon text-gray-700 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-[#f5f5fa]",
                        classes?.iconWrapper,
                    )}
                >
                    {icon}
                </span>
            )}
            <h2
                className={cn(
                    "nextra-card-title font-semibold text-base text-gray-800 dark:text-white",
                    {
                        "mt-4": children !== undefined,
                    },
                    classes?.title,
                )}
            >
                {title}
            </h2>
            {children && <span className={cn("mt-1 font-normal text-gray-600 dark:text-gray-400", classes?.content)}>{children}</span>}
        </div>
    );

    if (href) {
        content = (
            <Link
                className={wrapperClassName}
                href={href}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            >
                {content}
            </Link>
        );
    } else {
        content = <div className={wrapperClassName}>{content}</div>;
    }

    return content;
};

export default Card;
