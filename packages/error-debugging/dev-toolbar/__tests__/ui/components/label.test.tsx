// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import Label from "../../../src/ui/components/label";

afterEach(cleanup);

describe("label", () => {
    it("renders children", () => {
        expect.hasAssertions();

        render(<Label>Email</Label>);

        expect(screen.getByText("Email")).toBeInTheDocument();
    });

    it("has base classes", () => {
        expect.hasAssertions();

        const { container } = render(<Label>lbl</Label>);

        expect(container.firstChild).toHaveClass("text-sm", "font-medium", "leading-none");
    });

    it("sets htmlFor attribute via for prop", () => {
        expect.hasAssertions();

        const { container } = render(<Label for="email-input">Email</Label>);

        expect(container.firstChild).toHaveAttribute("for", "email-input");
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        const { container } = render(<Label class="custom-label">lbl</Label>);

        expect(container.firstChild).toHaveClass("custom-label");
    });

    it("passes through additional attributes", () => {
        expect.hasAssertions();

        render(<Label data-testid="my-label">lbl</Label>);

        expect(screen.getByTestId("my-label")).toBeInTheDocument();
    });

    it("renders as label element", () => {
        expect.hasAssertions();

        render(<Label>lbl</Label>);

        expect(screen.getByText("lbl").tagName).toBe("LABEL");
    });
});
