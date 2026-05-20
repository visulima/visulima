import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: ReactNode;
    unit?: string;
    sub?: ReactNode;
    tone?: "default" | "good" | "warn" | "bad";
    variant?: "hero" | "compact" | "stat";
    className?: string;
    children?: ReactNode;
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
    default: "text-fg",
    good: "text-success",
    warn: "text-warning",
    bad: "text-accent",
};

/**
 * Hero  — verdict-style mono number, no card chrome. One per screen.
 * Stat  — label/value row with a thin underline.
 * Compact — small bordered block for grid stacks.
 */
export const StatCard = ({
    label,
    value,
    unit,
    sub,
    tone = "default",
    variant = "compact",
    className,
    children,
}: StatCardProps) => {
    if (variant === "hero") {
        return (
            <div className={cn("flex flex-col gap-4", className)}>
                <div className="nd-label">{label}</div>
                <div className="flex items-baseline gap-3">
                    <div className={cn("nd-hero", toneClass[tone])}>{value}</div>
                    {unit ? <div className="nd-mono text-[14px] uppercase tracking-[0.16em] text-faint">{unit}</div> : null}
                </div>
                {children}
                {sub ? <div className="nd-mono text-[12px] uppercase tracking-[0.12em] text-faint">{sub}</div> : null}
            </div>
        );
    }

    if (variant === "stat") {
        return (
            <div className={cn("flex items-baseline justify-between gap-4 border-b border-border py-3", className)}>
                <span className="nd-label">{label}</span>
                <span className="flex items-baseline gap-1">
                    <span className={cn("nd-mono text-[15px]", toneClass[tone])}>{value}</span>
                    {unit ? <span className="nd-mono text-[10px] uppercase tracking-[0.12em] text-faint">{unit}</span> : null}
                </span>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-2 border border-border bg-panel p-5", className)}>
            <div className="nd-label">{label}</div>
            <div className="flex items-baseline gap-1.5">
                <span className={cn("nd-mono text-[28px] leading-none", toneClass[tone])}>{value}</span>
                {unit ? <span className="nd-mono text-[11px] uppercase tracking-[0.12em] text-faint">{unit}</span> : null}
            </div>
            {sub ? <div className="text-[12px] text-muted">{sub}</div> : null}
        </div>
    );
};
