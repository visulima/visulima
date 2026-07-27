/**
 * setup-flow.tsx — Stepper, TextInput, CheckboxGroup, ThinkingBlock
 *
 * A multi-step setup wizard composed from the input and layout components.
 * Flow blocks like this ship as examples to copy and adapt, not as library
 * exports — your steps and validation are app-specific.
 *
 * Controls:
 *   Tab / Enter   advance
 *   Esc           quit
 *
 * Run: node --import @oxc-node/core/register examples/setup-flow.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { CheckboxGroup } from "@visulima/tui-kit/checkbox-group";
import { Stepper } from "@visulima/tui-kit/stepper";
import { TextInput } from "@visulima/tui-kit/text-input";
import React, { useState } from "react";

const STEPS = [{ label: "Name" }, { label: "Features" }, { label: "Done" }];

const App = () => {
    const { exit } = useApp();
    const [step, setStep] = useState(0);
    const [name, setName] = useState("");
    const [features, setFeatures] = useState<ReadonlyArray<string>>([]);

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    const next = () => { setStep((value) => Math.min(STEPS.length - 1, value + 1)); };

    return (
        <Box borderStyle="round" flexDirection="column" gap={1} paddingX={2} paddingY={1}>
            <Stepper activeIndex={step} steps={STEPS} />

            {step === 0
                ? (
                <Box flexDirection="column">
                    <Text dimColor>Project name</Text>
                    <TextInput defaultValue={name} onChange={setName} onSubmit={next} />
                </Box>
                )
                : undefined}

            {step === 1
                ? (
                <Box flexDirection="column">
                    <Text dimColor>Pick features (space), Enter to continue</Text>
                    <CheckboxGroup
                        autoFocus
                        onChange={setFeatures}
                        onSubmit={next}
                        options={[
                            { label: "TypeScript", value: "ts" },
                            { label: "ESLint", value: "eslint" },
                            { label: "Tests", value: "tests" },
                        ]}
                    />
                </Box>
                )
                : undefined}

            {step === 2
                ? (
                <Box flexDirection="column">
                    <Text color="green">Setup complete</Text>
                    <Text dimColor>{`name: ${name || "(unnamed)"}`}</Text>
                    <Text dimColor>{`features: ${features.length > 0 ? features.join(", ") : "none"}`}</Text>
                </Box>
                )
                : undefined}

            <Text dimColor>Esc to quit</Text>
        </Box>
    );
};

render(<App />);
