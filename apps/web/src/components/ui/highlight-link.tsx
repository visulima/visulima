import type { CreateLinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { ClassValue } from "clsx";
import type { FC, PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

const HighlightLink: FC<
    PropsWithChildren<
        CreateLinkProps & {
            className?: ClassValue;
            icon?: ReactNode;
            mode?: "dark" | "light";
        }
    >
> = ({ children, className, icon, mode = "light", ...properties }) => (
    <Link
        {...properties}
        className={cn(
            "group border-background/10 relative block w-full overflow-hidden border border-l-2 p-5 transition duration-700 before:absolute before:top-0 before:right-0 before:bottom-0 before:left-0 before:-translate-x-full before:transition before:duration-500 hover:before:translate-x-0",
            {
                "border-l-black text-black hover:border-black hover:text-white hover:before:bg-black": mode === "light",
                "border-l-white text-white hover:border-white hover:text-black hover:before:bg-white": mode === "dark",
            },
            className,
        )}
    >
        <div className="relative z-10 flex flex-row gap-4">
            {children}
            {icon && <div className="grow" />}
            {icon}
        </div>
    </Link>
);

export default HighlightLink;
