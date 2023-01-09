import type { LinkProps } from "next/link";
import Link from "next/link";
import type {
    FC, HTMLProps, PropsWithChildren, ReactNode,
} from "react";

import { cn } from "../utils";

export const Card: FC<
PropsWithChildren<LinkProps & { title: string; icon: ReactNode; image?: boolean; arrow?: boolean; href: string; className?: string }>
> = ({
    children, title, icon, image, arrow, href, className, ...properties
}) => {
    const animatedArrow = arrow ? <span className={cn("transition-transform duration-75", "group-hover:translate-x-[2px]")}>→</span> : null;

    if (image) {
        return (
            <Link
                href={href}
                className={cn(
                    "nextra-card",
                    "group flex flex-col justify-start overflow-hidden rounded-lg",
                    "border border-gray-200 hover:border-gray-300 bg-gray-100 text-current no-underline",
                    "transition-all duration-200 dark:border-neutral-700",
                    "dark:bg-neutral-800 dark:text-gray-50 dark:shadow-none dark:hover:border-neutral-500 dark:hover:bg-neutral-700 dark:hover:shadow-none",
                    "shadow shadow-gray-100 hover:shadow-lg hover:shadow-gray-100",
                    "active:shadow-sm active:shadow-gray-200",
                    className,
                )}
                {...properties}
            >
                {children}
                <span className={cn("nextra-card-title", "gap-2 p-4 text-gray-700 dark:text-gray-300", "hover:text-gray-900 dark:hover:text-gray-100")}>
                    {icon}
                    <span className="flex gap-1">
                        {title}
                        {animatedArrow}
                    </span>
                </span>
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className={cn(
                "nextra-card",
                "group flex flex-col justify-start overflow-hidden rounded-lg border border-gray-200",
                "bg-transparent text-current no-underline shadow-sm shadow-gray-100",
                "transition-all duration-200 dark:border-neutral-800 dark:shadow-none",
                "hover:border-gray-300 hover:bg-slate-50 hover:shadow-lg",
                "hover:shadow-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:shadow-none",
                "active:shadow-sm active:shadow-gray-200",
            )}
            {...properties}
        >
            <span className={cn("nextra-card-title", "gap-2 p-4 text-gray-700 dark:text-neutral-200", "hover:text-gray-900 dark:hover:text-neutral-50")}>
                {icon}
                {title}
                {animatedArrow}
            </span>
        </Link>
    );
};

export const Cards: FC<PropsWithChildren<HTMLProps<HTMLDivElement> & { num: number; style: HTMLProps<HTMLDivElement>["style"] & { "--rows"?: string } }>> = ({
    children,
    num,
    style,
    className,
    ...properties
}) => (
    <div
        className={cn("nextra-cards", "mt-4 gap-4", className)}
        {...properties}
        style={{
            "--rows": String(num || 3),
            ...style,
        }}
    >
        {children}
    </div>
);
