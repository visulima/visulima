import { ComponentProps, FC } from "react";
import { useDetails } from "../contexts";
import cn from "clsx";
import { ArrowRightIcon } from "nextra/icons";

const Summary: FC<
    ComponentProps<"summary"> & {
        variant?: "default" | "raw";
        iconProps?: ComponentProps<typeof ArrowRightIcon>;
    }
> = ({ variant = "default", className = "", children, iconProps = {}, ...props }) => {
    const setOpen = useDetails();

    return (
        <summary
            className={cn(
                variant === "default" ? "p-1 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800" : "",
                "cursor-pointer list-none flex items-center",
                "[&::-webkit-details-marker]:hidden",
                className,
            )}
            {...props}
            onClick={(e) => {
                e.preventDefault();
                setOpen((v) => !v);
            }}
        >
            <ArrowRightIcon
                {...iconProps}
                className={cn("h-[1.2em] w-[1.2em] p-0.5 shrink-0", iconProps.className)}
                pathClassName={cn(
                    "origin-center transition-transform stroke-[3px] rtl:-rotate-180",
                    "ltr:[[open]>summary>svg>&]:rotate-90",
                    "rtl:[[open]>summary>svg>&]:rotate-[-270deg]",
                    iconProps.pathClassName,
                )}
            />
            {children}
        </summary>
    );
};

export default Summary;
