import type { TimeSeriesPoint } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SparklineProps {
    className?: string;
    height?: number;
    points: TimeSeriesPoint[];
    showAverage?: boolean;
    showAxis?: boolean;
    stroke?: string;
}

/**
 * Nothing-style line chart. 1.2px stroke `--fg`, optional dashed faint
 * average line. No fill, no legend, no zebra. Horizontal grid in `--border`.
 */
export const Sparkline = ({ className, height = 64, points, showAverage = true, showAxis = true, stroke = "var(--fg)" }: SparklineProps) => {
    if (points.length < 2) {
        return <div className={cn("nd-mono py-6 text-[12px] uppercase tracking-[0.12em] text-faint", className)}>[INSUFFICIENT DATA]</div>;
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const step = 100 / (points.length - 1);
    const path = points
        .map((p, i) => {
            const x = (i * step).toFixed(2);
            const y = (height - ((p.value - min) / range) * (height - 8) - 4).toFixed(2);

            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    const avgY = (height - ((avg - min) / range) * (height - 8) - 4).toFixed(2);

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <svg
                aria-label="Time-series chart"
                className="block w-full"
                preserveAspectRatio="none"
                role="img"
                style={{ height }}
                viewBox={`0 0 100 ${String(height)}`}
            >
                {showAxis
                    ? (
                    <g>
                        <line stroke="var(--border)" strokeWidth="0.5" x1="0" x2="100" y1="0" y2="0" />
                        <line stroke="var(--border)" strokeDasharray="0.5,1" strokeWidth="0.3" x1="0" x2="100" y1={height / 2} y2={height / 2} />
                        <line stroke="var(--border)" strokeWidth="0.5" x1="0" x2="100" y1={height} y2={height} />
                    </g>
                    )
                    : null}
                {showAverage ? <line stroke="var(--faint)" strokeDasharray="1.5,1.5" strokeWidth="0.5" x1="0" x2="100" y1={avgY} y2={avgY} /> : null}
                <path d={path} fill="none" stroke={stroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            </svg>
            {showAxis
                ? (
                <div className="nd-label flex justify-between text-faint">
                    <span>{min.toFixed(0)}</span>
                    {showAverage
                        ? (
                        <span>
                            AVG
                            {avg.toFixed(1)}
                        </span>
                        )
                        : null}
                    <span>{max.toFixed(0)}</span>
                </div>
                )
                : null}
        </div>
    );
};
