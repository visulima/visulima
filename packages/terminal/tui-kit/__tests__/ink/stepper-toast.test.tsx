import React from "react";
import { describe, expect, it } from "vitest";

import { Stepper, Toast } from "../../src/index";
import { renderToString } from "../helpers/ink-render";

describe(Stepper, () => {
    it("should render all steps with labels", () => {
        expect.assertions(3);

        const output = renderToString(<Stepper activeIndex={1} steps={[{ label: "First" }, { label: "Second" }, { label: "Third" }]} />);

        expect(output).toContain("First");
        expect(output).toContain("Second");
        expect(output).toContain("Third");
    });

    it("should use the status icons derived from activeIndex", () => {
        expect.assertions(3);

        const output = renderToString(<Stepper activeIndex={1} steps={[{ label: "a" }, { label: "b" }, { label: "c" }]} />);

        // completed
        expect(output).toContain("✔");
        // active
        expect(output).toContain("●");
        // pending
        expect(output).toContain("○");
    });

    it("should render an error icon for error steps", () => {
        expect.assertions(1);

        const output = renderToString(<Stepper steps={[{ label: "oops", status: "error" }]} />);

        expect(output).toContain("✖");
    });

    it("should render vertical layout with descriptions", () => {
        expect.assertions(2);

        const output = renderToString(<Stepper activeIndex={0} orientation="vertical" steps={[{ description: "Set up the environment", label: "Install" }]} />);

        expect(output).toContain("Install");
        expect(output).toContain("Set up the environment");
    });
});

describe(Toast, () => {
    it("should render the body, title, and variant icon", () => {
        expect.assertions(3);

        const output = renderToString(
            <Toast title="Saved" variant="success" visible>
                Your changes were saved.
            </Toast>,
        );

        expect(output).toContain("Saved");
        expect(output).toContain("Your changes were saved.");
        expect(output).toContain("✔");
    });

    it("should render nothing when visible is false", () => {
        expect.assertions(1);

        const output = renderToString(
            <Toast variant="info" visible={false}>
                hidden
            </Toast>,
        );

        expect(output).toBe("");
    });
});
