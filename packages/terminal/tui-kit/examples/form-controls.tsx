/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * form-controls.tsx — Button, Checkbox, Switch, RadioGroup, Divider demo
 *
 * Controls:
 *   Tab      cycle focus between controls
 *   Space    toggle checkbox / switch / select radio
 *   Enter    press button
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/form-controls.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Button } from "@visulima/tui-kit/button";
import { Checkbox } from "@visulima/tui-kit/checkbox";
import { Divider } from "@visulima/tui-kit/divider";
import { RadioGroup } from "@visulima/tui-kit/radio-group";
import { Switch } from "@visulima/tui-kit/switch";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [checked, setChecked] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [size, setSize] = useState("medium");
    const [pressed, setPressed] = useState(0);

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Form controls
            </Text>
            <Divider label="Button" length={40} />
            <Button autoFocus onPress={() => setPressed((n) => n + 1)}>
                Click me (
{pressed}
)
            </Button>
            <Divider label="Checkbox & Switch" length={40} />
            <Box gap={2}>
                <Checkbox isChecked={checked} onChange={setChecked}>
                    Accept terms
                </Checkbox>
                <Switch onChange={setEnabled} value={enabled}>
                    Enabled
                </Switch>
            </Box>
            <Divider label="Radio group" length={40} />
            <RadioGroup
                defaultValue="medium"
                onChange={setSize}
                options={[
                    { label: "Small", value: "small" },
                    { label: "Medium", value: "medium" },
                    { label: "Large", value: "large" },
                ]}
            />
            <Divider length={40} />
            <Text dimColor>
                pressed=
                {pressed}
                {" | "}
                checked=
                {String(checked)}
                {" | "}
                enabled=
                {String(enabled)}
                {" | "}
                size=
                {size}
            </Text>
        </Box>
    );
};

render(<App />);
