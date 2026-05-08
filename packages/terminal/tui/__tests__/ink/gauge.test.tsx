import React from "react";
import { describe, expect, it } from "vitest";

import { Gauge } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe(Gauge, () => {
    it("should render the numeric readout with rounded default formatting", () => {
        expect.assertions(1);

        const output = renderToString(<Gauge value={42.6} />);

        expect(output).toContain("43");
    });

    it("should respect a custom formatter", () => {
        expect.assertions(1);

        const output = renderToString(<Gauge formatValue={(value) => `${value.toFixed(1)}%`} value={42} />);

        expect(output).toContain("42.0%");
    });

    it("should render the optional label", () => {
        expect.assertions(1);

        const output = renderToString(<Gauge label="CPU" value={25} />);

        expect(output).toContain("CPU");
    });

    it("should clamp values into the [min, max] range", () => {
        expect.assertions(1);

        const output = renderToString(<Gauge max={100} min={0} value={999} />);

        expect(output).toContain("100");
    });

    it("should paint braille pixels for the arc and needle", () => {
        expect.assertions(1);

        const output = renderToString(<Gauge showValue={false} size="small" value={50} />);

        expect(output).toMatch(/[\u2800-\u28FF]/);
    });

    it("should render a legend row when showLegend is true", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gauge
                label="Disk"
                showLegend
                thresholds={[
                    { color: "green", label: "OK", max: 50 },
                    { color: "yellow", label: "Warn", max: 80 },
                    { color: "red", label: "Crit", max: 100 },
                ]}
                value={40}
            />,
        );

        expect(output).toContain("OK");
        expect(output).toContain("Crit");
    });
});
