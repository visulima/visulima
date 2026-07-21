/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";
import type { LiteralUnion } from "type-fest";

export type ApprovalRisk = "high" | "low" | "medium";

export type ApprovalDecision = "allow-always" | "allow-once" | "deny";

export type Props = {
    /**
     * Accent color for the highlighted option letters. Overrides the risk color.
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the prompt on mount. Set to `false` if a parent already
     * owns focus and routes input to this component.
     * @default true
     */
    readonly autoFocus?: boolean;

    /**
     * Optional body rendered between the header and the prompt line (e.g. a
     * rendered diff or command preview).
     */
    readonly children?: ReactNode;

    /**
     * Accessible description of what approving will do.
     */
    readonly description?: string;

    /**
     * Disable input; use when a parent manages focus and input routing.
     */
    readonly isDisabled?: boolean;

    /**
     * Resolution callback. Called once the user answers.
     */
    readonly onDecision: (decision: ApprovalDecision) => void;

    /**
     * Params shown as a compact key=value preview.
     */
    readonly params?: Readonly<Record<string, unknown>>;

    /**
     * Severity badge; controls the border color.
     * @default "medium"
     */
    readonly risk?: ApprovalRisk;

    /**
     * Name of the tool / action under review.
     */
    readonly tool: string;
};

const RISK_COLOR: Record<ApprovalRisk, LiteralUnion<AnsiColors, string>> = {
    high: "red",
    low: "green",
    medium: "yellow",
};

const RISK_LABEL: Record<ApprovalRisk, string> = {
    high: "HIGH RISK",
    low: "LOW RISK",
    medium: "MEDIUM RISK",
};

const formatParameterValue = (value: unknown): string => {
    if (value === null) {
        return "null";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string -- last-resort fallback when value isn't JSON-serializable
        return String(value);
    }
};

/**
 * Three-way approval prompt for tool calls. Resolves via `onDecision`:
 * `y` / Enter → allow-once, `a` → allow-always, `n` / Esc → deny.
 * @returns A bordered `ReactElement` containing the risk banner, params
 * preview, optional body, and the prompt line.
 */
export default function ApprovalPrompt({
    accentColor,
    autoFocus = true,
    children,
    description,
    isDisabled = false,
    onDecision,
    params,
    risk = "medium",
    tool,
}: Props): ReactElement {
    const riskColor = RISK_COLOR[risk];
    const color = accentColor ?? riskColor;
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });

    useInput(
        useCallback(
            (input, key) => {
                const typed = input.toLowerCase();

                if (typed === "y" || key.return) {
                    onDecision("allow-once");

                    return;
                }

                if (typed === "a") {
                    onDecision("allow-always");

                    return;
                }

                if (typed === "n" || key.escape) {
                    onDecision("deny");
                }
            },
            [onDecision],
        ),
        { isActive: !isDisabled && isFocused },
    );

    const parameterEntries = params === undefined ? [] : Object.entries(params);

    return (
        <Box borderColor={riskColor} borderStyle="round" flexDirection="column" paddingX={1}>
            <Box>
                <Text backgroundColor={riskColor} color="black">
                    {" "}
                    {RISK_LABEL[risk]}
{" "}
                </Text>
                <Text>
                    {" "}
                    <Text bold>{tool}</Text>
                </Text>
            </Box>
            {description === undefined
                ? undefined
                : (
                <Box marginTop={1}>
                    <Text>{description}</Text>
                </Box>
                )}
            {parameterEntries.length === 0
                ? undefined
                : (
                <Box flexDirection="column" marginTop={1}>
                    {parameterEntries.map(([name, value]) => (
                        <Box key={name}>
                            <Text color="cyan">
{name}
=
                            </Text>
                            <Text wrap="truncate-end">{formatParameterValue(value)}</Text>
                        </Box>
                    ))}
                </Box>
                )}
            {children === undefined ? undefined : <Box marginTop={1}>{children}</Box>}
            <Box marginTop={1}>
                <Text>
                    Allow? [
                    <Text bold color={color}>
                        y
                    </Text>
                    es /
{" "}
                    <Text bold color={color}>
                        a
                    </Text>
                    lways /
{" "}
                    <Text bold color={color}>
                        n
                    </Text>
                    o ]
                </Text>
            </Box>
        </Box>
    );
}

export { ApprovalPrompt };
export type { Props as ApprovalPromptProps };
