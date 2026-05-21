/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * form.tsx — Form + FormField + useForm + MaskedInput + SearchInput + ConfirmDialog
 *
 * Controls:
 *   Tab               cycle focus
 *   (type)            edit current field
 *   Enter (in body)   submit
 *   y / n (dialog)    confirm / cancel
 *   Esc               quit
 *
 * Run: node --import @oxc-node/core/register examples/form.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Button } from "@visulima/tui/components/button";
import { ConfirmDialog } from "@visulima/tui/components/confirm-dialog";
import { Form, FormField } from "@visulima/tui/components/form";
import { MaskedInput } from "@visulima/tui/components/masked-input";
import { SearchInput } from "@visulima/tui/components/search-input";
import { Text } from "@visulima/tui/components/text";
import { TextInput } from "@visulima/tui/components/text-input";
import { useApp } from "@visulima/tui/hooks/use-app";
import type { FieldConfig } from "@visulima/tui/hooks/use-form";
import { useForm } from "@visulima/tui/hooks/use-form";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitted, setSubmitted] = useState<Record<string, string> | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    const form = useForm<Record<string, FieldConfig<string>>>({
        fields: {
            email: {
                initialValue: "",
                validate: (value) => (typeof value === "string" && value.includes("@") ? undefined : "must be an email"),
            },
            name: {
                initialValue: "",
                validate: (value) => (value.length >= 2 ? undefined : "must have ≥ 2 chars"),
            },
        },
        onSubmit: (values) => {
            setSubmitted(values);
            setShowConfirm(true);
        },
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Form description="All fields required." title="Create account" width={60}>
                <FormField error={form.touched.name ? form.errors.name : undefined} label="Name" required>
                    <TextInput onChange={(value) => form.setValue("name", value)} onSubmit={() => form.setTouched("name")} placeholder="Jane Doe" />
                </FormField>
                <FormField error={form.touched.email ? form.errors.email : undefined} label="Email" required>
                    <TextInput onChange={(value) => form.setValue("email", value)} onSubmit={() => form.setTouched("email")} placeholder="jane@example.com" />
                </FormField>
                <FormField description="US format: (555) 123-4567" label="Phone">
                    <MaskedInput mask="(###) ###-####" />
                </FormField>
                <FormField label="Search company">
                    <SearchInput placeholder="Type to filter…" suggestions={["Acme", "Anthropic", "Apple"]} />
                </FormField>
                <Button onPress={() => void form.submit()}>Submit</Button>
            </Form>
            {showConfirm && (
                <ConfirmDialog onCancel={() => setShowConfirm(false)} onConfirm={exit} title="All set?" tone="info">
                    <Box flexDirection="column">
                        <Text>
                            Submit as <Text bold>{submitted?.name ?? ""}</Text> &lt;
                            {submitted?.email ?? ""}
                            &gt;?
                        </Text>
                    </Box>
                </ConfirmDialog>
            )}
        </Box>
    );
};

render(<App />);
