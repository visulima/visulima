import React from "react";
import { describe, expect, it } from "vitest";

import { Breadcrumb, Card, DefinitionList, Divider, Heading, Kbd, LoadingIndicator, Paragraph, Sparkline, Tag, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe(Divider, () => {
    it("should render a horizontal line", () => {
        expect.assertions(1);

        const output = renderToString(<Divider length={10} />);

        expect(output).toContain("─".repeat(10));
    });

    it("should render a custom character", () => {
        expect.assertions(1);

        const output = renderToString(<Divider character="=" length={5} />);

        expect(output).toContain("=====");
    });

    it("should render a label between line segments", () => {
        expect.assertions(1);

        const output = renderToString(<Divider label="Section" length={30} />);

        expect(output).toContain("Section");
    });

    it("should render a vertical divider across multiple rows", () => {
        expect.assertions(1);

        const output = renderToString(<Divider length={3} orientation="vertical" />);

        const lines = output.split("\n").filter((l) => l.includes("│"));

        expect(lines.length).toBeGreaterThanOrEqual(3);
    });
});

describe(Kbd, () => {
    it("should render a solid key cap by default", () => {
        expect.assertions(1);

        const output = renderToString(<Kbd>Enter</Kbd>);

        expect(output).toContain("Enter");
    });

    it("should render an outline variant with a border", () => {
        expect.assertions(2);

        const output = renderToString(<Kbd variant="outline">Esc</Kbd>);

        expect(output).toContain("Esc");
        // round border characters
        expect(output).toMatch(/[╭╮╯╰]/);
    });

    it("should render a bare variant without decoration", () => {
        expect.assertions(1);

        const output = renderToString(<Kbd variant="bare">Tab</Kbd>);

        expect(output).toContain("Tab");
    });
});

describe(Tag, () => {
    it("should render subtle variant by default", () => {
        expect.assertions(1);

        const output = renderToString(<Tag>new</Tag>);

        expect(output).toContain("new");
    });

    it("should render icon and label", () => {
        expect.assertions(2);

        const output = renderToString(<Tag icon="★">featured</Tag>);

        expect(output).toContain("★");
        expect(output).toContain("featured");
    });

    it("should render outline variant with border", () => {
        expect.assertions(2);

        const output = renderToString(<Tag variant="outline">beta</Tag>);

        expect(output).toContain("beta");
        expect(output).toMatch(/[╭╮╯╰]/);
    });
});

describe(Heading, () => {
    it("should render level 1 heading without prefix", () => {
        expect.assertions(1);

        const output = renderToString(<Heading>Title</Heading>);

        expect(output).toContain("Title");
    });

    it("should render lower levels with a prefix", () => {
        expect.assertions(1);

        const output = renderToString(<Heading level={3}>Subsection</Heading>);

        expect(output).toContain("## Subsection");
    });
});

describe(Paragraph, () => {
    it("should render body text", () => {
        expect.assertions(1);

        const output = renderToString(<Paragraph>Hello world.</Paragraph>);

        expect(output).toContain("Hello world.");
    });
});

describe(Breadcrumb, () => {
    it("should render items separated by the separator", () => {
        expect.assertions(3);

        const output = renderToString(<Breadcrumb items={[{ label: "Home" }, { label: "Docs" }, { label: "Guide" }]} />);

        expect(output).toContain("Home");
        expect(output).toContain("Guide");
        expect(output).toContain("›");
    });

    it("should respect a custom separator", () => {
        expect.assertions(1);

        const output = renderToString(<Breadcrumb items={[{ label: "a" }, { label: "b" }]} separator="/" />);

        expect(output).toContain("/");
    });
});

describe(DefinitionList, () => {
    it("should render inline term and description pairs", () => {
        expect.assertions(2);

        const output = renderToString(
            <DefinitionList
                items={[
                    { description: "1.0.0", term: "Version" },
                    { description: "MIT", term: "License" },
                ]}
            />,
        );

        expect(output).toContain("Version");
        expect(output).toContain("1.0.0");
    });

    it("should render stacked layout", () => {
        expect.assertions(2);

        const output = renderToString(<DefinitionList items={[{ description: "Value", term: "Key" }]} layout="stacked" />);

        expect(output).toContain("Key");
        expect(output).toContain("Value");
    });
});

describe(Sparkline, () => {
    it("should render a glyph for every data point", () => {
        expect.assertions(1);

        const output = renderToString(<Sparkline data={[1, 2, 3, 4, 5]} />);
        const glyphMatches = output.match(/[▁▂▃▄▅▆▇█]/g) ?? [];

        expect(glyphMatches).toHaveLength(5);
    });

    it("should render the lowest glyph when all values are equal", () => {
        expect.assertions(1);

        const output = renderToString(<Sparkline data={[3, 3, 3]} />);

        expect(output).toContain("▁".repeat(3));
    });

    it("should render nothing for an empty data set", () => {
        expect.assertions(1);

        const output = renderToString(<Sparkline data={[]} />);

        expect(output).toBe("");
    });
});

describe(Card, () => {
    it("should render a title, body, and border", () => {
        expect.assertions(3);

        const output = renderToString(
            <Card title="Card Title" width={30}>
                <Text>Card body content</Text>
            </Card>,
        );

        expect(output).toContain("Card Title");
        expect(output).toContain("Card body content");
        expect(output).toMatch(/[╭╮╯╰]/);
    });

    it("should render subtitle when provided", () => {
        expect.assertions(1);

        const output = renderToString(
            <Card subtitle="A small description" title="Hello" width={40}>
                <Text>Body</Text>
            </Card>,
        );

        expect(output).toContain("A small description");
    });
});

describe(LoadingIndicator, () => {
    it("should render a label next to the spinner", () => {
        expect.assertions(1);

        const output = renderToString(<LoadingIndicator>Loading...</LoadingIndicator>);

        expect(output).toContain("Loading...");
    });
});
