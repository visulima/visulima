import { Text } from "@visulima/tui/components/text";
import React from "react";
import { describe, expect, it } from "vitest";

import { Alert, Badge, OrderedList, StatusMessage, UnorderedList } from "../../src/index";
import { renderToString } from "../helpers/ink-render";

describe(Badge, () => {
    it("should render uppercase label", () => {
        expect.assertions(1);

        const output = renderToString(<Badge>info</Badge>);

        expect(output).toContain("INFO");
    });

    it("should render non-string children as-is", () => {
        expect.assertions(1);

        const output = renderToString(
            <Badge>
                <Text>custom</Text>
            </Badge>,
        );

        expect(output).toContain("custom");
    });

    it("should render with custom color", () => {
        expect.assertions(1);

        const output = renderToString(<Badge color="red">error</Badge>);

        expect(output).toContain("ERROR");
    });
});

describe(StatusMessage, () => {
    it("should render success variant with checkmark", () => {
        expect.assertions(2);

        const output = renderToString(<StatusMessage variant="success">Done!</StatusMessage>);

        expect(output).toContain("✔");
        expect(output).toContain("Done!");
    });

    it("should render error variant with cross", () => {
        expect.assertions(2);

        const output = renderToString(<StatusMessage variant="error">Failed</StatusMessage>);

        expect(output).toContain("✖");
        expect(output).toContain("Failed");
    });

    it("should render warning variant", () => {
        expect.assertions(2);

        const output = renderToString(<StatusMessage variant="warning">Careful</StatusMessage>);

        expect(output).toContain("⚠");
        expect(output).toContain("Careful");
    });

    it("should render info variant", () => {
        expect.assertions(2);

        const output = renderToString(<StatusMessage variant="info">Note</StatusMessage>);

        expect(output).toContain("ℹ");
        expect(output).toContain("Note");
    });
});

describe(Alert, () => {
    it("should render with message", () => {
        expect.assertions(1);

        const output = renderToString(<Alert variant="info">Hello</Alert>);

        expect(output).toContain("Hello");
    });

    it("should render with title and message", () => {
        expect.assertions(2);

        const output = renderToString(
            <Alert title="Warning" variant="warning">
                Be careful
            </Alert>,
        );

        expect(output).toContain("Warning");
        expect(output).toContain("Be careful");
    });

    it("should render variant icon", () => {
        expect.assertions(1);

        const output = renderToString(<Alert variant="success">Saved</Alert>);

        expect(output).toContain("✔");
    });

    it("should render error variant", () => {
        expect.assertions(1);

        const output = renderToString(<Alert variant="error">Crash</Alert>);

        expect(output).toContain("✖");
    });
});

describe(UnorderedList, () => {
    it("should render items with markers", () => {
        expect.assertions(2);

        const output = renderToString(<UnorderedList items={[{ label: "First" }, { label: "Second" }]} />);

        expect(output).toContain("First");
        expect(output).toContain("Second");
    });

    it("should render with custom string marker", () => {
        expect.assertions(1);

        const output = renderToString(<UnorderedList items={[{ label: "Item" }]} marker="*" />);

        expect(output).toContain("*");
    });

    it("should render default marker", () => {
        expect.assertions(1);

        const output = renderToString(<UnorderedList items={[{ label: "Item" }]} />);

        expect(output).toContain("─");
    });

    it("should support nested lists", () => {
        expect.assertions(2);

        const output = renderToString(
            <UnorderedList
                items={[
                    {
                        children: [{ label: "Child" }],
                        label: "Parent",
                    },
                ]}
            />,
        );

        expect(output).toContain("Parent");
        expect(output).toContain("Child");
    });
});

describe(OrderedList, () => {
    it("should render numbered items", () => {
        expect.assertions(3);

        const output = renderToString(<OrderedList items={[{ label: "First" }, { label: "Second" }, { label: "Third" }]} />);

        expect(output).toContain("1.");
        expect(output).toContain("2.");
        expect(output).toContain("3.");
    });

    it("should render item content", () => {
        expect.assertions(2);

        const output = renderToString(<OrderedList items={[{ label: "Alpha" }, { label: "Beta" }]} />);

        expect(output).toContain("Alpha");
        expect(output).toContain("Beta");
    });

    it("should support nested lists", () => {
        expect.assertions(2);

        const output = renderToString(
            <OrderedList
                items={[
                    {
                        children: [{ label: "Child" }],
                        label: "Parent",
                    },
                ]}
            />,
        );

        expect(output).toContain("1.");
        expect(output).toContain("Child");
    });

    it("should pad numbers for alignment with many items", () => {
        expect.assertions(1);

        const items = Array.from({ length: 10 }, (_, index) => {
            return { label: `Item ${index + 1}` };
        });
        const output = renderToString(<OrderedList items={items} />);

        expect(output).toContain("10.");
    });
});
