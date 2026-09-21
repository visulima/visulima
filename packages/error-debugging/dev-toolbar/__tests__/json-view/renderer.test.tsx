// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../setup";

import type { Spec } from "@json-render/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import type { JSX } from "preact";
import { toChildArray } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JsonViewRegistry } from "../../src/json-view";
import { JsonView } from "../../src/json-view";

afterEach(cleanup);

const Box = ({ children, label }: { children?: JSX.Element[]; label?: string }): JSX.Element => (
    <div data-testid="box">
        {label}
        {children}
    </div>
);

const Pressable = ({ label, onClick }: { label: string; onClick?: (event: Event) => void }): JSX.Element => (
    <button onClick={onClick} type="button">
        {label}
    </button>
);

const registry: JsonViewRegistry = { Box, Pressable };

describe("jsonView", () => {
    it("renders the root element and its children in order", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                child1: { props: { label: "first" }, type: "Box" },
                child2: { props: { label: "second" }, type: "Box" },
                root: { children: ["child1", "child2"], props: {}, type: "Box" },
            },
            root: "root",
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.getAllByTestId("box").map((node) => node.textContent)).toStrictEqual(["firstsecond", "first", "second"]);
    });

    it("skips a child reference that has no element", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                kept: { props: { label: "kept" }, type: "Box" },
                root: { children: ["missing", "kept"], props: {}, type: "Box" },
            },
            root: "root",
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.getByText("kept")).toBeInTheDocument();
    });

    it("skips an element whose type is not in the registry", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                root: { children: ["unknown"], props: {}, type: "Box" },
                unknown: { props: { label: "ghost" }, type: "NotRegistered" },
            },
            root: "root",
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.queryByText("ghost")).not.toBeInTheDocument();
    });

    it("hides an element whose visible condition is false for the seeded state", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                hidden: { props: { label: "secret" }, type: "Box", visible: { $state: "/revealed" } },
                root: { children: ["hidden"], props: {}, type: "Box" },
            },
            root: "root",
            state: { revealed: false },
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.queryByText("secret")).not.toBeInTheDocument();
    });

    it("resolves a prop bound to state", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: { root: { props: { label: { $state: "/title" } }, type: "Box" } },
            root: "root",
            state: { title: "from state" },
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.getByText("from state")).toBeInTheDocument();
    });

    it("dispatches a named action with its params when the bound event fires", () => {
        expect.hasAssertions();

        const refresh = vi.fn();

        const spec: Spec = {
            elements: { root: { on: { click: { action: "refresh", params: { source: "header" } } }, props: { label: "Refresh" }, type: "Pressable" } },
            root: "root",
        };

        render(<JsonView actions={{ refresh }} registry={registry} spec={spec} />);
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

        expect(refresh).toHaveBeenCalledWith({ source: "header" }, expect.anything());
    });

    it("re-renders when an action writes to the store", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                pane: { props: { label: "now visible" }, type: "Box", visible: { $state: "/revealed" } },
                root: { children: ["toggle", "pane"], props: {}, type: "Box" },
                toggle: { on: { click: { action: "reveal" } }, props: { label: "Reveal" }, type: "Pressable" },
            },
            root: "root",
            state: { revealed: false },
        };

        render(
            <JsonView
                actions={{
                    reveal: (_parameters, store) => {
                        store.set("/revealed", true);
                    },
                }}
                registry={registry}
                spec={spec}
            />,
        );

        expect(screen.queryByText("now visible")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

        expect(screen.getByText("now visible")).toBeInTheDocument();
    });

    it("dispatches every binding when an event carries an array of them", () => {
        expect.hasAssertions();

        const first = vi.fn();
        const second = vi.fn();

        const spec: Spec = {
            elements: {
                root: {
                    on: { click: [{ action: "first" }, { action: "second" }] },
                    props: { label: "Both" },
                    type: "Pressable",
                },
            },
            root: "root",
        };

        render(<JsonView actions={{ first, second }} registry={registry} spec={spec} />);
        fireEvent.click(screen.getByRole("button", { name: "Both" }));

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("lets a later binding see what an earlier one wrote", () => {
        expect.hasAssertions();

        const observed: unknown[] = [];

        const spec: Spec = {
            elements: {
                root: {
                    on: { click: [{ action: "write" }, { action: "observe", params: { seen: { $state: "/flag" } } }] },
                    props: { label: "Go" },
                    type: "Pressable",
                },
            },
            root: "root",
            state: { flag: false },
        };

        render(
            <JsonView
                actions={{
                    observe: (parameters) => {
                        observed.push(parameters["seen"]);
                    },
                    write: (_parameters, store) => {
                        store.set("/flag", true);
                    },
                }}
                registry={registry}
                spec={spec}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Go" }));

        expect(observed).toStrictEqual([true]);
    });

    it("calls preventDefault only when the binding asks for it", () => {
        expect.hasAssertions();

        const spec = (preventDefault: boolean): Spec => {
            return {
                elements: { root: { on: { click: { action: "noop", preventDefault } }, props: { label: "Go" }, type: "Pressable" } },
                root: "root",
            };
        };

        const { unmount } = render(<JsonView actions={{ noop: () => {} }} registry={registry} spec={spec(true)} />);
        const prevented = !fireEvent.click(screen.getByRole("button", { name: "Go" }));

        unmount();
        render(<JsonView actions={{ noop: () => {} }} registry={registry} spec={spec(false)} />);
        const notPrevented = !fireEvent.click(screen.getByRole("button", { name: "Go" }));

        expect(prevented).toBe(true);
        expect(notPrevented).toBe(false);
    });

    it("keeps a slot for a child that renders nothing, so positional parents stay aligned", () => {
        expect.hasAssertions();

        // A parent that pairs children to something else by position — a tab
        // strip to its panes — must see the hidden child as a gap, not have
        // every later child shift up one place.
        const Positional = ({ children }: { children?: JSX.Element[] }): JSX.Element => {
            const panes = toChildArray(children);

            return <div data-testid="third">{panes[2]}</div>;
        };

        const spec: Spec = {
            elements: {
                first: { props: { label: "first" }, type: "Box", visible: false },
                root: { children: ["first", "second", "third"], props: {}, type: "Positional" },
                second: { props: { label: "second" }, type: "Box" },
                third: { props: { label: "third" }, type: "Box" },
            },
            root: "root",
        };

        render(<JsonView registry={{ ...registry, Positional }} spec={spec} />);

        expect(screen.getByTestId("third")).toHaveTextContent("third");
    });
});
