import cn from "clsx";
import { ArrowRightIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";

import { useDetails } from "../contexts";

const Summary = ({
    variant = "default",
    className = "",
    children,
    iconProps: iconProperties = {},
    ...properties
}: ComponentProps<"summary"> & {
    variant?: "default" | "raw";
    iconProps?: ComponentProps<typeof ArrowRightIcon>;
}): ReactElement => {
    const setOpen = useDetails();

    return (
        <summary
            className={cn(
                variant === "default" ? "flex items-center cursor-pointer list-none p-1 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800" : "",
                "before:mr-1 before:inline-block before:transition-transform before:content-[''] dark:before:invert",
                "rtl:before:rotate-180 [[data-expanded]>&]:before:rotate-90",
                className,
            )}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
            onClick={(event) => {
                event.preventDefault();
                setOpen((value) => !value);
            }}
        >
            <ArrowRightIcon
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...iconProperties}
                className={cn("h-[1.2em] w-[1.2em] p-0.5 shrink-0", iconProperties.className)}
                pathClassName={cn(
                    "origin-center transition-transform stroke-[3px] rtl:-rotate-180",
                    "ltr:[[open]>summary>svg>&]:rotate-90",
                    "rtl:[[open]>summary>svg>&]:rotate-[-270deg]",
                    iconProperties.pathClassName,
                )}
            />
            {children}
        </summary>
    );
};

export default Summary;
