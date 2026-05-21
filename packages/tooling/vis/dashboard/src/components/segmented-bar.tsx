import { cn } from "@/lib/utils";

interface SegmentedBarProps {
    className?: string;
    max?: number;
    segments?: number;
    size?: "hero" | "standard" | "compact";
    tone?: "neutral" | "good" | "warn" | "bad";
    value: number;
}

const toneClass: Record<NonNullable<SegmentedBarProps["tone"]>, string> = {
    bad: "bg-accent",
    good: "bg-success",
    neutral: "bg-fg",
    warn: "bg-warning",
};

const sizeHeight: Record<NonNullable<SegmentedBarProps["size"]>, string> = {
    compact: "h-[6px]",
    hero: "h-[18px]",
    standard: "h-[10px]",
};

/**
 * Signature Nothing-style segmented progress bar. Discrete blocks with 2px gaps —
 * mechanical, instrument-like. Filled segments use the tone color; empty use border.
 */
export const SegmentedBar = ({ className, max = 1, segments = 32, size = "standard", tone = "neutral", value }: SegmentedBarProps) => {
    const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
    const filled = Math.round(ratio * segments);

    return (
        <div aria-valuemax={max} aria-valuemin={0} aria-valuenow={value} className={cn("flex w-full gap-[2px]", sizeHeight[size], className)} role="meter">
            {Array.from({ length: segments }, (_, i) => (
                <span className={cn("block flex-1", i < filled ? toneClass[tone] : "bg-border2 opacity-40")} key={i} />
            ))}
        </div>
    );
};
