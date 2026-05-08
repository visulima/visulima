import React from "react";
import { describe, expect, it } from "vitest";

import { Spinner } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe(Spinner, () => {
    it("should render default dots spinner", () => {
        expect.assertions(1);

        const output = renderToString(<Spinner />);

        // The first frame of the dots spinner is "⠋"
        expect(output).toBe("⠋");
    });

    it("should render a different spinner type", () => {
        expect.assertions(1);

        const output = renderToString(<Spinner type="line" />);

        // The first frame of the line spinner is "-"
        expect(output).toBe("-");
    });
});
