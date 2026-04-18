import type { TimeSeriesPoint } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SparklineProps {
    points: TimeSeriesPoint[];
    className?: string;
    stroke?: string;
    fill?: string;
    height?: number;
}

/**
 * Minimal inline-SVG sparkline. Uses a preserveAspectRatio="none"
 * viewBox so the line always stretches to the full width of its
 * container — the dashboard renders sparklines inside cards of
 * variable width.
 */
export const Sparkline = ({
    points,
    className,
    stroke = "var(--chart-2)",
    fill,
    height = 48,
}: SparklineProps) => {
    if (!points || points.length < 2) {
        return <div className={cn("text-xs text-muted-foreground", className)}>Not enough data yet.</div>;
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = 100 / (points.length - 1);
    const path = points
        .map((p, i) => {
            const x = (i * step).toFixed(2);
            const y = (height - ((p.value - min) / range) * (height - 4) - 2).toFixed(2);

            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    const area = fill
        ? `${path} L 100 ${String(height)} L 0 ${String(height)} Z`
        : undefined;

    return (
        <svg
            role="img"
            aria-label="Time-series chart"
            className={cn("block w-full", className)}
            viewBox={`0 0 100 ${String(height)}`}
            preserveAspectRatio="none"
            style={{ height }}
        >
            {area ? <path d={area} fill={fill} opacity={0.25} /> : null}
            <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
        </svg>
    );
};
