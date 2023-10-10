import cn from "clsx";
import { ArrowRightIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";
import { useState } from "react";

import { useDetails } from "../contexts";

const Summary = ({
    children,
    className = "",
    iconProps: iconProperties = {},
    variant = "default",
    ...properties
}: ComponentProps<"summary"> & {
    iconProps?: ComponentProps<"svg"> & {
        pathClassName?: string;
    };
    variant?: "default" | "raw";
}): ReactElement => {
    const setOpen = useDetails();
    const [open, setOpenState] = useState(false);

    return (
        <summary
            aria-expanded={open ? "true" : "false"}
            className={cn(
                variant === "default" ? "flex items-center cursor-pointer list-none p-1 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800" : "",
                "before:mr-1 before:inline-block before:transition-transform before:content-[''] dark:before:invert before:shrink-0",
                "rtl:before:rotate-180 [[data-expanded]>&]:before:rotate-90",
                className,
            )}
            role="button"
            tabIndex={0}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
            onClick={(event) => {
                event.preventDefault();

                setOpen((value) => !value);
                setOpenState((value) => !value);
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
