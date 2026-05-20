import type { TimeSeriesPoint } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SparklineProps {
    points: TimeSeriesPoint[];
    className?: string;
    stroke?: string;
    height?: number;
    showAverage?: boolean;
    showAxis?: boolean;
}

/**
 * Nothing-style line chart. 1.2px stroke `--fg`, optional dashed faint
 * average line. No fill, no legend, no zebra. Horizontal grid in `--border`.
 */
export const Sparkline = ({
    points,
    className,
    stroke = "var(--fg)",
    height = 64,
    showAverage = true,
    showAxis = true,
}: SparklineProps) => {
    if (points.length < 2) {
        return (
            <div className={cn("nd-mono py-6 text-[12px] uppercase tracking-[0.12em] text-faint", className)}>
                [INSUFFICIENT DATA]
            </div>
        );
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
                role="img"
                aria-label="Time-series chart"
                className="block w-full"
                viewBox={`0 0 100 ${String(height)}`}
                preserveAspectRatio="none"
                style={{ height }}
            >
                {showAxis ? (
                    <g>
                        <line x1="0" y1="0" x2="100" y2="0" stroke="var(--border)" strokeWidth="0.5" />
                        <line x1="0" y1={height / 2} x2="100" y2={height / 2} stroke="var(--border)" strokeWidth="0.3" strokeDasharray="0.5,1" />
                        <line x1="0" y1={height} x2="100" y2={height} stroke="var(--border)" strokeWidth="0.5" />
                    </g>
                ) : null}
                {showAverage ? (
                    <line
                        x1="0"
                        y1={avgY}
                        x2="100"
                        y2={avgY}
                        stroke="var(--faint)"
                        strokeWidth="0.5"
                        strokeDasharray="1.5,1.5"
                    />
                ) : null}
                <path d={path} fill="none" stroke={stroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            </svg>
            {showAxis ? (
                <div className="nd-label flex justify-between text-faint">
                    <span>{min.toFixed(0)}</span>
                    {showAverage ? <span>AVG {avg.toFixed(1)}</span> : null}
                    <span>{max.toFixed(0)}</span>
                </div>
            ) : null}
        </div>
    );
};
