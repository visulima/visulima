// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import Badge from "../../../src/ui/components/badge";

afterEach(cleanup);

describe("badge", () => {
    it("renders children", () => {
        expect.hasAssertions();

        render(<Badge>New</Badge>);

        expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("applies default variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge>badge</Badge>);

        expect(container.firstChild).toHaveClass("bg-primary", "text-primary-foreground");
    });

    it("applies secondary variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge variant="secondary">badge</Badge>);

        expect(container.firstChild).toHaveClass("bg-secondary");
    });

    it("applies destructive variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge variant="destructive">badge</Badge>);

        expect(container.firstChild).toHaveClass("bg-destructive");
    });

    it("applies outline variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge variant="outline">badge</Badge>);

        expect(container.firstChild).toHaveClass("text-foreground");
    });

    it("applies info variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge variant="info">badge</Badge>);

        expect(container.firstChild).toHaveClass("bg-info");
    });

    it("applies warning variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge variant="warning">badge</Badge>);

        expect(container.firstChild).toHaveClass("bg-warning");
    });

    it("applies success variant classes", () => {
        expect.hasAssertions();

        const { container } = render(<Badge variant="success">badge</Badge>);

        expect(container.firstChild).toHaveClass("bg-success");
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        const { container } = render(<Badge class="my-badge">badge</Badge>);

        expect(container.firstChild).toHaveClass("my-badge");
    });

    it("passes through additional attributes", () => {
        expect.hasAssertions();

        render(<Badge data-testid="badge-el">badge</Badge>);

        expect(screen.getByTestId("badge-el")).toBeInTheDocument();
    });
});
