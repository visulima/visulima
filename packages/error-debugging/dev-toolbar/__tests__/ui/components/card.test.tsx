// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../src/ui/components/card";

afterEach(cleanup);

describe("card", () => {
    it("card has bg-card class", () => {
        expect.hasAssertions();

        const { container } = render(<Card>content</Card>);

        expect(container.firstChild).toHaveClass("bg-card");
    });

    it("cardHeader has p-6 class", () => {
        expect.hasAssertions();

        const { container } = render(<CardHeader>header</CardHeader>);

        expect(container.firstChild).toHaveClass("p-6");
    });

    it("cardTitle renders as h3 with font-semibold", () => {
        expect.hasAssertions();

        render(<CardTitle>Title</CardTitle>);
        const h3 = screen.getByRole("heading", { level: 3 });

        expect(h3).toBeInTheDocument();
        expect(h3).toHaveClass("font-semibold");
    });

    it("cardDescription has text-muted-foreground", () => {
        expect.hasAssertions();

        const { container } = render(<CardDescription>desc</CardDescription>);

        expect(container.firstChild).toHaveClass("text-muted-foreground");
    });

    it("cardContent has p-6 and pt-0", () => {
        expect.hasAssertions();

        const { container } = render(<CardContent>content</CardContent>);

        expect(container.firstChild).toHaveClass("p-6", "pt-0");
    });

    it("cardFooter has flex and items-center", () => {
        expect.hasAssertions();

        const { container } = render(<CardFooter>footer</CardFooter>);

        expect(container.firstChild).toHaveClass("flex", "items-center");
    });

    it("all parts accept custom class", () => {
        expect.hasAssertions();

        const { container: c1 } = render(<Card class="custom-card">card</Card>);

        expect(c1.firstChild).toHaveClass("custom-card");

        const { container: c2 } = render(<CardHeader class="custom-header">header</CardHeader>);

        expect(c2.firstChild).toHaveClass("custom-header");
    });

    it("renders compound card correctly", () => {
        expect.hasAssertions();

        render(
            <Card>
                <CardHeader>
                    <CardTitle>My Title</CardTitle>
                    <CardDescription>My Description</CardDescription>
                </CardHeader>
                <CardContent>Body</CardContent>
                <CardFooter>Footer</CardFooter>
            </Card>,
        );

        expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("My Title");
        expect(screen.getByText("My Description")).toBeInTheDocument();
        expect(screen.getByText("Body")).toBeInTheDocument();
        expect(screen.getByText("Footer")).toBeInTheDocument();
    });
});
