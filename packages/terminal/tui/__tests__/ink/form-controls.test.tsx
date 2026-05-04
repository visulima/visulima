import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Accordion, Button, Checkbox, Collapsible, RadioGroup, render, Switch, Text } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

let currentUnmount: (() => void) | undefined;

const setup = async (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { unmount } = render(jsx, { debug: true, stdin, stdout });

    currentUnmount = unmount;
    await delay(50);

    const getOutput = () => {
        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

        return (calls.at(-1)?.[0] ?? "") as string;
    };

    return { getOutput, stdin, stdout };
};

afterEach(async () => {
    currentUnmount?.();
    currentUnmount = undefined;
    await delay(100);
});

describe(Button, () => {
    it("should render the label", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Button autoFocus>Press me</Button>);

        expect(getOutput()).toContain("Press me");
    });

    it("should call onPress when Enter is pressed", async () => {
        const onPress = vi.fn();
        const { stdin } = await setup(
            <Button autoFocus onPress={onPress}>
                Go
            </Button>,
        );

        emitReadable(stdin, "\r");
        await vi.waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
    });

    it("should call onPress when Space is pressed", async () => {
        const onPress = vi.fn();
        const { stdin } = await setup(
            <Button autoFocus onPress={onPress}>
                Go
            </Button>,
        );

        emitReadable(stdin, " ");
        await vi.waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
    });

    it("should not call onPress when disabled", async () => {
        expect.assertions(1);

        const onPress = vi.fn();
        const { stdin } = await setup(
            <Button autoFocus isDisabled onPress={onPress}>
                Go
            </Button>,
        );

        emitReadable(stdin, "\r");
        await delay(150);

        expect(onPress).not.toHaveBeenCalled();
    });
});

describe(Checkbox, () => {
    it("should render unchecked by default", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Checkbox autoFocus>Accept</Checkbox>);
        const output = getOutput();

        expect(output).toContain("Accept");
        expect(output).toContain("☐");
    });

    it("should toggle on Space", async () => {
        const onChange = vi.fn();
        const { stdin } = await setup(
            <Checkbox autoFocus onChange={onChange}>
                Accept
            </Checkbox>,
        );

        emitReadable(stdin, " ");
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    });

    it("should respect controlled isChecked prop", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Checkbox autoFocus isChecked>
                Accept
            </Checkbox>,
        );

        expect(getOutput()).toContain("☒");
    });
});

describe(Switch, () => {
    it("should render on and off labels", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Switch autoFocus defaultValue={false} />);
        const output = getOutput();

        expect(output).toContain("off");
        expect(output).toContain("on");
    });

    it("should toggle the value on Space", async () => {
        const onChange = vi.fn();
        const { stdin } = await setup(<Switch autoFocus onChange={onChange} />);

        emitReadable(stdin, " ");
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    });

    it("should use custom labels", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Switch autoFocus labels={["no", "yes"]} />);
        const output = getOutput();

        expect(output).toContain("no");
        expect(output).toContain("yes");
    });
});

describe(RadioGroup, () => {
    const options = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
        { label: "Option C", value: "c" },
    ];

    it("should render all options", async () => {
        expect.assertions(3);

        const { getOutput } = await setup(<RadioGroup autoFocus options={options} />);
        const output = getOutput();

        expect(output).toContain("Option A");
        expect(output).toContain("Option B");
        expect(output).toContain("Option C");
    });

    it("should highlight the selected option with a filled dot", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<RadioGroup autoFocus options={options} />);

        expect(getOutput()).toContain("●");
    });

    it("should emit onChange when navigating down by default (commit-on-navigate)", async () => {
        const onChange = vi.fn();
        const { stdin } = await setup(<RadioGroup autoFocus defaultValue="a" onChange={onChange} options={options} />);

        emitReadable(stdin, "j");
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("b"));
    });

    it("should NOT emit onChange when navigating with commitOnNavigate={false}", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<RadioGroup autoFocus commitOnNavigate={false} defaultValue="a" onChange={onChange} options={options} />);

        emitReadable(stdin, "j");
        await delay(150);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should commit on Space when commitOnNavigate is false", async () => {
        const onChange = vi.fn();
        const { stdin } = await setup(<RadioGroup autoFocus commitOnNavigate={false} defaultValue="a" onChange={onChange} options={options} />);

        emitReadable(stdin, "j");
        await delay(100);
        emitReadable(stdin, " ");
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("b"));
    });

    it("should emit onSubmit when Enter is pressed", async () => {
        const onSubmit = vi.fn();
        const { stdin } = await setup(<RadioGroup autoFocus defaultValue="a" onSubmit={onSubmit} options={options} />);

        emitReadable(stdin, "\r");
        await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith("a"));
    });
});

describe(Collapsible, () => {
    it("should render the title and hide content when closed", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(
            <Collapsible autoFocus title="Section">
                hidden body
            </Collapsible>,
        );
        const output = getOutput();

        expect(output).toContain("Section");
        expect(output).not.toContain("hidden body");
    });

    it("should show content when defaultOpen is true", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Collapsible autoFocus defaultOpen title="Section">
                <Text>visible body</Text>
            </Collapsible>,
        );

        expect(getOutput()).toContain("visible body");
    });

    it("should call onToggle when Space is pressed", async () => {
        const onToggle = vi.fn();
        const { stdin } = await setup(
            <Collapsible autoFocus onToggle={onToggle} title="Section">
                <Text>body</Text>
            </Collapsible>,
        );

        emitReadable(stdin, " ");
        await vi.waitFor(() => expect(onToggle).toHaveBeenCalledWith(true));
    });
});

describe(Accordion, () => {
    const items = [
        { content: <Text>Body one</Text>, id: "1", title: "Panel One" },
        { content: <Text>Body two</Text>, id: "2", title: "Panel Two" },
    ];

    it("should render all panel titles", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Accordion autoFocus items={items} />);
        const output = getOutput();

        expect(output).toContain("Panel One");
        expect(output).toContain("Panel Two");
    });

    it("should start with defaultExpanded items open", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Accordion autoFocus defaultExpanded={["1"]} items={items} />);

        expect(getOutput()).toContain("Body one");
    });

    it("should allow multiple panels open when allowMultiple is true", async () => {
        const { getOutput, stdin } = await setup(<Accordion allowMultiple autoFocus defaultExpanded={["1"]} items={items} />);

        emitReadable(stdin, "j");
        await delay(100);
        emitReadable(stdin, " ");
        await vi.waitFor(() => {
            const output = getOutput();

            expect(output).toContain("Body one");
            expect(output).toContain("Body two");
        });
    });
});
