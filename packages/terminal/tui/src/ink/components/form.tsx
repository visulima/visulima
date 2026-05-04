import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type FormFieldProps = {
    /**
     * The input element (TextInput, Checkbox, Select, …).
     */
    readonly children: ReactNode;

    /**
     * Optional helper text rendered beneath the input.
     */
    readonly description?: string;

    /**
     * Validation error — dimmed red below the input.
     */
    readonly error?: string;

    /**
     * When true, the field's label and description are dim.
     */
    readonly isDisabled?: boolean;

    /**
     * Label rendered above the input.
     */
    readonly label: string;

    /**
     * Mark the field as required (adds a trailing `*`).
     */
    readonly required?: boolean;
};

/**
 * Standard form field wrapper: label + input + helper/error.
 */
export const FormField = ({ children, description, error, isDisabled = false, label, required = false }: FormFieldProps): ReactElement => (
    <Box flexDirection="column" marginBottom={1}>
        <Box>
            <Text bold dimColor={isDisabled}>
                {label}
            </Text>
            {required ? <Text color="red"> *</Text> : undefined}
        </Box>
        <Box marginTop={0}>{children}</Box>
        {/* eslint-disable-next-line sonarjs/no-nested-conditional -- minimal three-way render: error → description → nothing */}
        {error === undefined ? description === undefined ? undefined : <Text dimColor>{description}</Text> : <Text color="red">{error}</Text>}
    </Box>
);

export type Props = {
    /**
     * Accent color for the form chrome.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Render a border around the form.
     * @default true
     */
    readonly bordered?: boolean;

    /**
     * Fields composed via `&lt;FormField />`.
     */
    readonly children: ReactNode;

    /**
     * Optional description rendered under the title.
     */
    readonly description?: string;

    /**
     * Optional footer rendered below the fields (buttons, hints, summary).
     */
    readonly footer?: ReactNode;

    /**
     * Optional heading rendered at the top.
     */
    readonly title?: string;

    /**
     * Fixed width.
     */
    readonly width?: number;
};

type FormComponent = ((props: Props) => ReactElement) & { Field: typeof FormField };

/**
 * Stateless form layout. Pair with the `useForm` hook for state management
 * and `FormField` for consistent label/error styling.
 */
const Form: FormComponent = Object.assign(
    ({ accentColor = "blue", bordered = true, children, description, footer, title, width }: Props): ReactElement => {
        const content = (
            <Box flexDirection="column">
                {title === undefined
                    ? undefined
                    : (
                    <Box marginBottom={1}>
                        <Text bold color={accentColor}>
                            {title}
                        </Text>
                    </Box>
                    )}
                {description === undefined
                    ? undefined
                    : (
                    <Box marginBottom={1}>
                        <Text dimColor>{description}</Text>
                    </Box>
                    )}
                <Box flexDirection="column">{children}</Box>
                {footer === undefined ? undefined : <Box marginTop={1}>{footer}</Box>}
            </Box>
        );

        if (!bordered) {
            return (
                <Box flexDirection="column" width={width}>
                    {content}
                </Box>
            );
        }

        return (
            <Box borderColor={accentColor} borderStyle="round" flexDirection="column" paddingX={1} paddingY={1} width={width}>
                {content}
            </Box>
        );
    },
    { Field: FormField },
);

export default Form;
