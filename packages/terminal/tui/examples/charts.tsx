/* eslint-disable sonarjs/pseudo-random -- demo data only, no security implications */

/**
 * charts.tsx — Sparkline, BarChart, LineChart, AreaChart, ScatterPlot,
 *              Histogram, Heatmap, Gauge
 *
 * Controls:
 *   + / -    shift Gauge value
 *   r        regenerate random data
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/charts.tsx
 */
import { render } from "@visulima/tui";
import { AreaChart } from "@visulima/tui/components/area-chart";
import { BarChart } from "@visulima/tui/components/bar-chart";
import { Box } from "@visulima/tui/components/box";
import { Gauge } from "@visulima/tui/components/gauge";
import { Heatmap } from "@visulima/tui/components/heatmap";
import { Histogram } from "@visulima/tui/components/histogram";
import { LineChart } from "@visulima/tui/components/line-chart";
import { ScatterPlot } from "@visulima/tui/components/scatter-plot";
import { Sparkline } from "@visulima/tui/components/sparkline";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const randomSeries = (length: number, max = 100): ReadonlyArray<number> => Array.from({ length }, () => Math.round(Math.random() * max));

const App = () => {
    const { exit } = useApp();
    const [gauge, setGauge] = useState(42);
    const [version, setVersion] = useState(0);

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        switch (input) {
            case "+":
            case "=": {
                setGauge((g) => Math.min(100, g + 5));

                break;
            }
            case "-":
            case "_": {
                setGauge((g) => Math.max(0, g - 5));

                break;
            }
            case "r": {
                setVersion((v) => v + 1);

                break;
            }
            // No default
        }
    });

    const trend = React.useMemo(() => randomSeries(24, 100), [version]);
    const histData = React.useMemo(() => randomSeries(120, 80), [version]);
    const bars = React.useMemo(
        () => [
            { label: "Mon", value: 32 },
            { label: "Tue", value: 48 },
            { label: "Wed", value: 21 },
            { label: "Thu", value: 67 },
            { label: "Fri", value: 55 },
        ],
        [],
    );

    const scatter = React.useMemo(
        () =>
            Array.from({ length: 40 }, () => {
                return { x: Math.random() * 100, y: Math.random() * 100 };
            }),
        [version],
    );

    const heatmapData = React.useMemo(() => Array.from({ length: 6 }, () => Array.from({ length: 12 }, () => Math.round(Math.random() * 100))), [version]);

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Sparkline
            </Text>
            <Sparkline color="green" data={trend} />
            <Text bold color="cyan">
                BarChart + Histogram
            </Text>
            <Box gap={4}>
                <BarChart data={bars} height={6} showValues />
                <Histogram bins={6} data={histData} height={6} />
            </Box>
            <Text bold color="cyan">
                LineChart + AreaChart
            </Text>
            <Box gap={4}>
                <LineChart
                    height={6}
                    series={[
                        { data: trend, label: "CPU" },
                        { data: trend.map((v) => (v + 20) % 100), label: "Mem" },
                    ]}
                    width={32}
                />
                <AreaChart fillDensity="medium" height={6} series={[{ data: trend, label: "Load" }]} showLegend={false} width={32} />
            </Box>
            <Text bold color="cyan">
                ScatterPlot + Heatmap
            </Text>
            <Box gap={4}>
                <ScatterPlot height={6} maxX={100} maxY={100} minX={0} minY={0} series={[{ data: scatter, label: "points" }]} showLegend={false} width={24} />
                <Heatmap data={heatmapData} rowLabels={["A", "B", "C", "D", "E", "F"]} />
            </Box>
            <Text bold color="cyan">
                Gauge (+/- to adjust)
            </Text>
            <Gauge
                label="CPU load"
                showLegend
                thresholds={[
                    { color: "green", label: "OK", max: 50 },
                    { color: "yellow", label: "Warn", max: 80 },
                    { color: "red", label: "Crit", max: 100 },
                ]}
                value={gauge}
            />
        </Box>
    );
};

render(<App />);
