import type { Props as BoxProps } from "../Box";
import type { Props as TextProps } from "../Text";

type StyleFnProps = {
    readonly depth?: number;
    readonly hasChildren?: boolean;
    readonly isExpanded?: boolean;
    readonly isFocused?: boolean;
    readonly isLoading?: boolean;
    readonly isSelected?: boolean;
};

const theme = {
    styles: {
        container: (): BoxProps => ({
            flexDirection: "column" as const,
        }),
        expandIndicator: (_props: StyleFnProps): TextProps => ({
            color: "gray",
        }),
        focusIndicator: (): TextProps => ({
            color: "blue",
        }),
        indent: ({ depth }: StyleFnProps): BoxProps => ({
            width: (depth ?? 0) * 2,
        }),
        label: ({ isFocused, isSelected }: StyleFnProps): TextProps => {
            let color: string | undefined;

            if (isSelected) {
                color = "green";
            }

            if (isFocused) {
                color = "blue";
            }

            return { color };
        },
        loadingIndicator: (): TextProps => ({
            color: "yellow",
        }),
        node: ({ isFocused }: StyleFnProps): BoxProps => ({
            gap: 1,
            paddingLeft: isFocused ? 0 : 2,
        }),
        selectedIndicator: (): TextProps => ({
            color: "green",
        }),
    },
};

export { theme };
export type Theme = typeof theme;
