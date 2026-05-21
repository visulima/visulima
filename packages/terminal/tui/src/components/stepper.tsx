/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { Fragment } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type StepStatus = "active" | "completed" | "error" | "pending";

export type StepperStep = {
    readonly description?: string;
    readonly key?: string;
    readonly label: ReactNode;
    readonly status?: StepStatus;
};

export type Props = {
    /**
     * Color used for active and completed steps.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Index of the current step (used when steps do not provide a status).
     * @default 0
     */
    readonly activeIndex?: number;

    /**
     * Color used for errors.
     * @default "red"
     */
    readonly errorColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Orientation of the stepper.
     * @default "horizontal"
     */
    readonly orientation?: "horizontal" | "vertical";

    /**
     * List of steps.
     */
    readonly steps: ReadonlyArray<StepperStep>;
};

const STATUS_ICON: Record<StepStatus, string> = {
    active: "●",
    completed: "✔",
    error: "✖",
    pending: "○",
};

const resolveStatus = (step: StepperStep, index: number, activeIndex: number): StepStatus => {
    if (step.status !== undefined) {
        return step.status;
    }

    if (index < activeIndex) {
        return "completed";
    }

    if (index === activeIndex) {
        return "active";
    }

    return "pending";
};

/**
 * Step indicator for multi-stage flows.
 * @returns A `ReactElement` rendering the steps horizontally or vertically.
 */
export default function Stepper({ accentColor = "blue", activeIndex = 0, errorColor = "red", orientation = "horizontal", steps }: Props): ReactElement {
    if (orientation === "vertical") {
        return (
            <Box flexDirection="column">
                {steps.map((step, index) => {
                    const status = resolveStatus(step, index, activeIndex);
                    const isLast = index === steps.length - 1;
                    // eslint-disable-next-line sonarjs/no-nested-conditional -- minimal three-way status mapping
                    const color = status === "error" ? errorColor : status === "pending" ? undefined : accentColor;

                    return (
                        <Box flexDirection="column" key={step.key ?? index}>
                            <Box>
                                <Text color={color} dimColor={status === "pending"}>
                                    {STATUS_ICON[status]}{" "}
                                </Text>
                                <Text bold={status === "active"} color={color} dimColor={status === "pending"}>
                                    {step.label}
                                </Text>
                            </Box>
                            {step.description === undefined ? undefined : (
                                <Box marginLeft={2}>
                                    <Text dimColor>{step.description}</Text>
                                </Box>
                            )}
                            {isLast ? undefined : (
                                <Box marginLeft={0}>
                                    <Text dimColor>│</Text>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
        );
    }

    return (
        <Box>
            {steps.map((step, index) => {
                const status = resolveStatus(step, index, activeIndex);
                // eslint-disable-next-line sonarjs/no-nested-conditional -- minimal three-way status mapping
                const color = status === "error" ? errorColor : status === "pending" ? undefined : accentColor;
                const isLast = index === steps.length - 1;

                return (
                    <Fragment key={step.key ?? index}>
                        <Box>
                            <Text color={color} dimColor={status === "pending"}>
                                {STATUS_ICON[status]}{" "}
                            </Text>
                            <Text bold={status === "active"} color={color} dimColor={status === "pending"}>
                                {step.label}
                            </Text>
                        </Box>
                        {isLast ? undefined : <Text dimColor> ── </Text>}
                    </Fragment>
                );
            })}
        </Box>
    );
}

export { Stepper };
export type { Props as StepperProps };
