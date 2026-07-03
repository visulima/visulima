// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../src/ui/components/tabs";

afterEach(cleanup);

const BasicTabs = ({ defaultValue = "tab1", onValueChange }: { defaultValue?: string; onValueChange?: (v: string) => void }): JSX.Element => (
    <Tabs defaultValue={defaultValue} onValueChange={onValueChange}>
        <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
    </Tabs>
);

describe("tabs", () => {
    it("tabsList has role=tablist", () => {
        expect.hasAssertions();

        render(<BasicTabs />);

        expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("tabsTrigger has role=tab", () => {
        expect.hasAssertions();

        render(<BasicTabs />);

        expect(screen.getAllByRole("tab")).toHaveLength(2);
    });

    it("tabsContent has role=tabpanel", () => {
        expect.hasAssertions();

        render(<BasicTabs />);

        expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });

    it("defaultValue activates the correct tab content", () => {
        expect.hasAssertions();

        render(<BasicTabs defaultValue="tab1" />);

        expect(screen.getByText("Content 1")).toBeInTheDocument();
        expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("clicking a tab changes active content", () => {
        expect.hasAssertions();

        render(<BasicTabs />);

        expect(screen.getByText("Content 1")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));

        expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
        expect(screen.getByText("Content 2")).toBeInTheDocument();
    });

    it("controlled value prop", () => {
        expect.hasAssertions();

        render(
            <Tabs value="tab2">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>,
        );

        expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
        expect(screen.getByText("Content 2")).toBeInTheDocument();
    });

    it("clicking calls onValueChange", () => {
        expect.hasAssertions();

        const onValueChange = vi.fn();

        render(<BasicTabs onValueChange={onValueChange} />);
        fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));

        expect(onValueChange).toHaveBeenCalledWith("tab2");
    });

    it("controlled: clicking does not self-change when no internal state update", () => {
        expect.hasAssertions();

        const onValueChange = vi.fn();

        render(
            <Tabs onValueChange={onValueChange} value="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>,
        );
        fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));

        expect(onValueChange).toHaveBeenCalledWith("tab2");
        // still shows tab1 content since controlled
        expect(screen.getByText("Content 1")).toBeInTheDocument();
    });

    it("inactive content is not rendered (null, not hidden)", () => {
        expect.hasAssertions();

        render(<BasicTabs defaultValue="tab1" />);

        expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("active content is visible", () => {
        expect.hasAssertions();

        render(<BasicTabs defaultValue="tab2" />);

        expect(screen.getByText("Content 2")).toBeVisible();
    });

    it("disabled trigger cannot be clicked", () => {
        expect.hasAssertions();

        const onValueChange = vi.fn();

        render(
            <Tabs defaultValue="tab1" onValueChange={onValueChange}>
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger disabled value="tab2">
                        Tab 2
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>,
        );
        fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));

        expect(onValueChange).not.toHaveBeenCalled();
        expect(screen.getByText("Content 1")).toBeInTheDocument();
    });

    it("merges custom class on TabsList", () => {
        expect.hasAssertions();

        render(
            <Tabs defaultValue="tab1">
                <TabsList class="custom-list">
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
            </Tabs>,
        );

        expect(screen.getByRole("tablist")).toHaveClass("custom-list");
    });
});
