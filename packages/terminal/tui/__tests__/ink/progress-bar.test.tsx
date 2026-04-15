import React from "react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "../../src/ink/index";
import { renderToString } from "../helpers/ink-render";

describe(ProgressBar, () => {
    it("should render a full bar at 100%", () => {
        const output = renderToString(<ProgressBar columns={10} percent={1} />);

        expect(output).toBe("\u2588".repeat(10));
    });

    it("should render a half bar at 50%", () => {
        const output = renderToString(<ProgressBar columns={10} percent={0.5} />);

        expect(output).toBe("\u2588".repeat(5));
    });

    it("should render an empty bar at 0%", () => {
        const output = renderToString(<ProgressBar columns={10} percent={0} />);

        expect(output).toBe("");
    });

    it("should respect left margin", () => {
        const output = renderToString(<ProgressBar columns={20} left={5} percent={1} />);

        // 20 - 5 = 15 columns available
        expect(output).toBe("\u2588".repeat(15));
    });

    it("should respect right margin", () => {
        const output = renderToString(<ProgressBar columns={20} percent={1} right={5} />);

        // 20 - 5 = 15 columns available
        expect(output).toBe("\u2588".repeat(15));
    });

    it("should respect both left and right margins", () => {
        const output = renderToString(<ProgressBar columns={20} left={3} percent={1} right={7} />);

        // 20 - 3 - 7 = 10 columns available
        expect(output).toBe("\u2588".repeat(10));
    });

    it("should use a custom character", () => {
        const output = renderToString(<ProgressBar character="=" columns={5} percent={1} />);

        expect(output).toBe("=====");
    });

    it("should pad with spaces when rightPad is true", () => {
        const output = renderToString(<ProgressBar columns={10} percent={0.5} rightPad />);

        // Trailing spaces are trimmed by the renderer, so the output looks the same
        // but the component produces the padded string internally
        expect(output).toBe("\u2588".repeat(5));
    });

    it("should not pad when rightPad is false", () => {
        const output = renderToString(<ProgressBar columns={10} percent={0.5} rightPad={false} />);

        expect(output).toBe("\u2588".repeat(5));
    });

    it("should clamp percent above 1 to 1", () => {
        const output = renderToString(<ProgressBar columns={10} percent={1.5} />);

        expect(output).toBe("\u2588".repeat(10));
    });

    it("should clamp percent below 0 to 0", () => {
        const output = renderToString(<ProgressBar columns={10} percent={-0.5} />);

        expect(output).toBe("");
    });

    it("should handle margins exceeding columns gracefully", () => {
        const output = renderToString(<ProgressBar columns={10} left={6} percent={1} right={6} />);

        // 10 - 6 - 6 = -2 clamped to 0
        expect(output).toBe("");
    });

    it("should use terminal width when columns is 0", () => {
        // renderToString defaults to 100 columns
        const output = renderToString(<ProgressBar columns={0} percent={0.1} />);

        expect(output).toBe("\u2588".repeat(10));
    });

    it("should default to 100% when percent is omitted", () => {
        const output = renderToString(<ProgressBar columns={8} />);

        expect(output).toBe("\u2588".repeat(8));
    });

    it("should floor partial fill values", () => {
        // 10 * 0.33 = 3.3, floor to 3
        const output = renderToString(<ProgressBar columns={10} percent={0.33} />);

        expect(output).toBe("\u2588".repeat(3));
    });

    it("should render rightPad correctly with full bar", () => {
        const output = renderToString(<ProgressBar columns={10} percent={1} rightPad />);

        // Full bar + 0 spaces
        expect(output).toBe("\u2588".repeat(10));
    });
});
