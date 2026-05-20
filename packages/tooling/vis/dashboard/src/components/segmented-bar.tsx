import { cn } from "@/lib/utils";

interface SegmentedBarProps {
    value: number;
    max?: number;
    segments?: number;
    tone?: "neutral" | "good" | "warn" | "bad";
    size?: "hero" | "standard" | "compact";
    className?: string;
}

const toneToneClass: Record<NonNullable<SegmentedBarProps["tone"]>, string> = {
    neutral: "bg-fg",
    good: "bg-success",
    warn: "bg-warning",
    bad: "bg-accent",
};

const sizeHeight: Record<NonNullable<SegmentedBarProps["size"]>, string> = {
    hero: "h-[18px]",
    standard: "h-[10px]",
    compact: "h-[6px]",
};

/**
 * Signature Nothing-style segmented progress bar. Discrete blocks with 2px gaps —
 * mechanical, instrument-like. Filled segments use the tone color; empty use border.
 */
export const SegmentedBar = ({
    value,
    max = 1,
    segments = 32,
    tone = "neutral",
    size = "standard",
    className,
}: SegmentedBarProps) => {
    const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
    const filled = Math.round(ratio * segments);

    return (
        <div
            className={cn("flex w-full gap-[2px]", sizeHeight[size], className)}
            role="meter"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
        >
            {Array.from({ length: segments }, (_, i) => (
                <span
                    key={i}
                    className={cn(
                        "block flex-1",
                        i < filled ? toneToneClass[tone] : "bg-border2 opacity-40",
                    )}
                />
            ))}
        </div>
    );
};
