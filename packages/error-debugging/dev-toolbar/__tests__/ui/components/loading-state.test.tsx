// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import LoadingState from "../../../src/ui/components/loading-state";

afterEach(cleanup);

describe("loadingState", () => {
    it("shows the label", () => {
        expect.hasAssertions();

        render(<LoadingState label="Scanning assets…" />);

        expect(screen.getByText("Scanning assets…")).toBeInTheDocument();
    });

    it("staggers three decorative dots", () => {
        expect.hasAssertions();

        const { container } = render(<LoadingState label="Loading" />);
        const dots = [...container.querySelectorAll("span.animate-pulse")];

        expect(dots.map((dot) => (dot as HTMLElement).style.animationDelay)).toStrictEqual(["0ms", "160ms", "320ms"]);
    });

    it("hides the dots from assistive technology", () => {
        expect.hasAssertions();

        const { container } = render(<LoadingState label="Loading" />);

        expect(container.querySelector("[aria-hidden=\"true\"]")).toBeInTheDocument();
    });
});
