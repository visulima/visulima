import delay from "delay";
import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Calendar, ConfirmDialog, DatePicker, Form, Placeholder, render, Text, useForm } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";
import waitFor from "../helpers/wait-for";

let currentUnmount: (() => void) | undefined;

const setup = async (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { unmount } = render(jsx, { debug: true, stdin, stdout });

    currentUnmount = unmount;

    const getOutput = () => {
        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

        return (calls.at(-1)?.[0] ?? "") as string;
    };

    // Wait until the component has produced output, then give useEffect
    // time to attach stdin listeners (setRawMode + useInput).
    await waitFor(() => getOutput().length > 0);
    await delay(50);

    return { getOutput, stdin };
};

afterEach(async () => {
    currentUnmount?.();
    currentUnmount = undefined;
    await delay(30);
});

describe(Calendar, () => {
    const fixedDate = new Date(2024, 5, 15); // 2024-06-15

    it("should render the month header and weekday row", () => {
        expect.assertions(3);

        const output = renderToString(<Calendar defaultValue={fixedDate} />);

        expect(output).toContain("June 2024");
        expect(output).toContain("Mo");
        expect(output).toContain("15");
    });

    it("should call onChange when arrow keys move the cursor", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Calendar autoFocus defaultValue={fixedDate} onChange={onChange} />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await waitFor(() => onChange.mock.calls.length > 0);

        const callArgs = onChange.mock.calls[0]?.[0] as Date | undefined;

        expect(callArgs?.getDate()).toBe(16);
    });

    it("should call onSubmit on Enter with the current cursor", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(<Calendar autoFocus defaultValue={fixedDate} onSubmit={onSubmit} />);

        emitReadable(stdin, "\r");
        await waitFor(() => onSubmit.mock.calls.length > 0);

        const callArgs = onSubmit.mock.calls[0]?.[0] as Date | undefined;

        expect(callArgs?.getDate()).toBe(15);
    });

    it("should not move past maxDate", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const max = new Date(2024, 5, 15);
        const { stdin } = await setup(<Calendar autoFocus defaultValue={fixedDate} maxDate={max} onChange={onChange} />);

        emitReadable(stdin, "\u001B[C"); // right arrow → would be 16, blocked
        await delay(40);

        expect(onChange).not.toHaveBeenCalled();
    });
});

describe(DatePicker, () => {
    it("should render placeholder when no value is set", () => {
        expect.assertions(1);

        const output = renderToString(<DatePicker placeholder="Pick date" />);

        expect(output).toContain("Pick date");
    });

    it("should format the selected date", () => {
        expect.assertions(1);

        const output = renderToString(<DatePicker defaultValue={new Date(2024, 0, 5)} />);

        expect(output).toContain("2024-01-05");
    });

    it("should open the calendar when Enter is pressed", async () => {
        expect.assertions(1);

        const { getOutput, stdin } = await setup(<DatePicker autoFocus defaultValue={new Date(2024, 5, 15)} />);

        emitReadable(stdin, "\r");
        await waitFor(() => getOutput().includes("June 2024"));

        expect(getOutput()).toContain("June 2024");
    });
});

describe(Placeholder, () => {
    it("should render the requested number of rows", () => {
        expect.assertions(1);

        const output = renderToString(<Placeholder animated={false} rows={4} width={10} />);
        const lines = output.split("\n").filter((line) => line.includes("█"));

        expect(lines).toHaveLength(4);
    });

    it("should vary line widths when `widths` is provided", () => {
        expect.assertions(1);

        // Use a plain-ASCII character to side-step Ink's width measurement of `█`
        // (the default), which treats the block glyph as a 2-cell wide character
        // and skews truncation in narrow boxes — hiding the relative-width signal
        // we're trying to assert here.
        const output = renderToString(<Placeholder animated={false} character="#" rows={2} width={10} widths={[1, 0.5]} />);
        const blockLines = output.split("\n").filter((line) => line.includes("#"));
        const first = (blockLines[0] ?? "").match(/#+/)?.[0].length ?? 0;
        const second = (blockLines[1] ?? "").match(/#+/)?.[0].length ?? 0;

        expect(second).toBeLessThan(first);
    });
});

describe(ConfirmDialog, () => {
    it("should render the title, body, and both buttons", () => {
        expect.assertions(4);

        const output = renderToString(
            <ConfirmDialog onCancel={vi.fn()} onConfirm={vi.fn()} title="Delete project?" tone="danger">
                This action cannot be undone.
            </ConfirmDialog>,
        );

        expect(output).toContain("Delete project?");
        expect(output).toContain("This action cannot be undone.");
        expect(output).toContain("Cancel");
        expect(output).toContain("Confirm");
    });

    it("should call onConfirm on y", async () => {
        expect.assertions(1);

        const onConfirm = vi.fn();
        const { stdin } = await setup(
            <ConfirmDialog onCancel={vi.fn()} onConfirm={onConfirm}>
                body
            </ConfirmDialog>,
        );

        emitReadable(stdin, "y");
        await waitFor(() => onConfirm.mock.calls.length > 0);

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("should call onCancel on Escape", async () => {
        expect.assertions(1);

        const onCancel = vi.fn();
        const { stdin } = await setup(
            <ConfirmDialog onCancel={onCancel} onConfirm={vi.fn()}>
                body
            </ConfirmDialog>,
        );

        emitReadable(stdin, "\u001B");
        await waitFor(() => onCancel.mock.calls.length > 0);

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("should call onCancel when Enter is pressed with cancel focused", async () => {
        expect.assertions(1);

        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        const { stdin } = await setup(
            <ConfirmDialog defaultFocus="cancel" onCancel={onCancel} onConfirm={onConfirm}>
                body
            </ConfirmDialog>,
        );

        emitReadable(stdin, "\r");
        await waitFor(() => onCancel.mock.calls.length > 0);

        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe(Form, () => {
    it("should render title, description, fields, and footer", () => {
        expect.assertions(4);

        const output = renderToString(
            <Form description="Please fill in" footer={<Text>footer-here</Text>} title="Profile">
                <Form.Field label="Name">
                    <Text>John Doe</Text>
                </Form.Field>
            </Form>,
        );

        expect(output).toContain("Profile");
        expect(output).toContain("Please fill in");
        expect(output).toContain("Name");
        expect(output).toContain("footer-here");
    });

    it("should render error and required indicator on fields", () => {
        expect.assertions(2);

        const output = renderToString(
            <Form>
                <Form.Field error="Required" label="Email" required>
                    <Text>john@example.com</Text>
                </Form.Field>
            </Form>,
        );

        expect(output).toContain("Required");
        expect(output).toContain("*");
    });
});

describe(useForm, () => {
    type Formlike = ReturnType<
        typeof useForm<{
            email: { initialValue: string; validate: (v: unknown) => string | undefined };
            name: { initialValue: string; validate: (v: unknown) => string | undefined };
        }>
    >;

    type FormlikeRef = { current: Formlike | undefined };

    const HookHarness = ({ formRef, recordResult }: { formRef: FormlikeRef; recordResult: (values: Record<string, unknown>) => void }) => {
        const form = useForm({
            fields: {
                email: {
                    initialValue: "",
                    validate: (value) => (typeof value === "string" && value.includes("@") ? undefined : "Invalid"),
                },
                name: {
                    initialValue: "",
                    validate: (value) => ((value as string).length >= 2 ? undefined : "Too short"),
                },
            },
            onSubmit: (values) => {
                recordResult(values);
            },
        });

        formRef.current = form;

        return <Text>form-harness</Text>;
    };

    it("should validate on submit and populate errors when invalid", async () => {
        expect.assertions(2);

        const recorded = vi.fn();
        const formRef: FormlikeRef = { current: undefined };

        await setup(<HookHarness formRef={formRef} recordResult={recorded} />);

        const ok = await formRef.current!.submit();

        await delay(30);

        expect(ok).toBe(false);
        expect(recorded).not.toHaveBeenCalled();
    });

    it("should submit when all fields are valid", async () => {
        expect.assertions(2);

        const recorded = vi.fn();
        const formRef: FormlikeRef = { current: undefined };

        await setup(<HookHarness formRef={formRef} recordResult={recorded} />);

        await act(async () => {
            formRef.current!.setValue("name", "John");
            formRef.current!.setValue("email", "john@example.com");
        });

        await delay(30);

        const ok = await formRef.current!.submit();

        expect(ok).toBe(true);
        expect(recorded).toHaveBeenCalledWith({ email: "john@example.com", name: "John" });
    });
});
