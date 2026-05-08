import type { Props as BoxProps } from "../box";
import type { Props as TextProps } from "../text";

type StyleFunctionProps = {
    readonly depth?: number;
    readonly hasChildren?: boolean;
    readonly isExpanded?: boolean;
    readonly isFocused?: boolean;
    readonly isLoading?: boolean;
    readonly isSelected?: boolean;
};

const theme = {
    styles: {
        container: (): BoxProps => {
            return {
                flexDirection: "column" as const,
            };
        },
        expandIndicator: (_props: StyleFunctionProps): TextProps => {
            return {
                color: "gray",
            };
        },
        focusIndicator: (): TextProps => {
            return {
                color: "blue",
            };
        },
        indent: ({ depth }: StyleFunctionProps): BoxProps => {
            return {
                width: (depth ?? 0) * 2,
            };
        },
        label: ({ isFocused, isSelected }: StyleFunctionProps): TextProps => {
            let color: string | undefined;

            if (isSelected) {
                color = "green";
            }

            if (isFocused) {
                color = "blue";
            }

            return { color };
        },
        loadingIndicator: (): TextProps => {
            return {
                color: "yellow",
            };
        },
        node: ({ isFocused }: StyleFunctionProps): BoxProps => {
            return {
                gap: 1,
                paddingLeft: isFocused ? 0 : 2,
            };
        },
        selectedIndicator: (): TextProps => {
            return {
                color: "green",
            };
        },
    },
};

export { theme };
export type Theme = typeof theme;
