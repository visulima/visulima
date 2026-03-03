// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "../../../src/ui/components/alert";

afterEach(cleanup);

describe("alert", () => {
    it("renders content", () => {
        expect.hasAssertions();

        render(<Alert>Alert content</Alert>);

        expect(screen.getByText("Alert content")).toBeInTheDocument();
    });

    it("applies default variant classes", () => {
        expect.hasAssertions();

        render(<Alert>alert</Alert>);

        expect(screen.getByRole("alert")).toHaveClass("bg-background", "text-foreground");
    });

    it("applies destructive variant classes", () => {
        expect.hasAssertions();

        render(<Alert variant="destructive">alert</Alert>);

        expect(screen.getByRole("alert")).toHaveClass("border-destructive/50", "text-destructive");
    });

    it("applies info variant classes", () => {
        expect.hasAssertions();

        render(<Alert variant="info">alert</Alert>);

        expect(screen.getByRole("alert")).toHaveClass("text-info");
    });

    it("applies warning variant classes", () => {
        expect.hasAssertions();

        render(<Alert variant="warning">alert</Alert>);

        expect(screen.getByRole("alert")).toHaveClass("text-warning");
    });

    it("applies success variant classes", () => {
        expect.hasAssertions();

        render(<Alert variant="success">alert</Alert>);

        expect(screen.getByRole("alert")).toHaveClass("text-success");
    });

    it("alertTitle has font-medium", () => {
        expect.hasAssertions();

        render(<AlertTitle>Title</AlertTitle>);

        expect(screen.getByText("Title")).toHaveClass("font-medium");
    });

    it("alertDescription has text-sm", () => {
        expect.hasAssertions();

        render(<AlertDescription>Description text</AlertDescription>);

        expect(screen.getByText("Description text")).toHaveClass("text-sm");
    });

    it("renders compound alert", () => {
        expect.hasAssertions();

        render(
            <Alert>
                <AlertTitle>Heads up!</AlertTitle>
                <AlertDescription>Something happened.</AlertDescription>
            </Alert>,
        );

        expect(screen.getByText("Heads up!")).toBeInTheDocument();
        expect(screen.getByText("Something happened.")).toBeInTheDocument();
    });

    it("merges custom class on all parts", () => {
        expect.hasAssertions();

        render(<Alert class="custom-alert">alert</Alert>);

        expect(screen.getByRole("alert")).toHaveClass("custom-alert");
    });
});
