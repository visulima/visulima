import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import type { FC, ReactNode } from "react";

import { cn } from "@/lib/utils";

const SectionTitle: FC<{
    classes?: {
        root?: ClassValue;
    };
    description?: ReactNode;
    mode?: "dark" | "light";
    position?: "left" | "center" | "right";
    prefix?: string;
    title: string;
}> = ({ classes, description, mode = "light", position = "left", prefix, title }) => (
    <div className={cn("flex flex-col gap-5", mode === "dark" && "dark", classes?.root)}>
        {prefix && (
            <span className="text-md font-mono">
                //
                {prefix}
            </span>
        )}
        <h2
            className={clsx("text-wrap-balance text-3xl font-bold", {
                "pl-20": position === "right",
                "pr-20": position === "left",
            })}
        >
            {title}
        </h2>
        {description && (
            <div
                className={clsx("text-wrap-balance mt-2 text-base/6", {
                    "pl-20": position === "right",
                    "pr-20": position === "left",
                })}
            >
                {description}
            </div>
        )}
    </div>
);

export default SectionTitle;
