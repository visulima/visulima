import type { ReactElement, ReactNode } from "react";
import { useRef } from "react";

import useTerminalPalette from "../hooks/use-terminal-palette";
import useWindowSize from "../hooks/use-window-size";
import Box from "./box";
import type { ScrollViewRef } from "./scroll";
import { ScrollView } from "./scroll";
import Text from "./text";

export type Props = {
    /**
     * Background color for the dialog. Defaults to the detected terminal
     * background color, falling back to `"black"`.
     */
    readonly backgroundColor?: string;

    /**
     * Border color.
     * @default "cyan"
     */
    readonly borderColor?: string;

    /**
     * Border style.
     * @default "round"
     */
    readonly borderStyle?: "arrow" | "bold" | "classic" | "double" | "doubleSingle" | "round" | "single" | "singleDouble";

    /**
     * Dialog content.
     */
    readonly children: ReactNode;

    /**
     * Override terminal columns. Useful in renderToString or testing contexts
     * where useWindowSize is unavailable.
     */
    readonly columns?: number;

    /**
     * Footer content rendered below the scrollable area.
     * Useful for hints like "Press ? to close".
     */
    readonly footer?: ReactNode;

    /**
     * Maximum height as a fraction of terminal rows (0-1) or absolute rows.
     * Values &lt;= 1 are treated as fractions; values > 1 as absolute row counts.
     * @default 0.8
     */
    readonly maxHeight?: number;

    /**
     * Padding inside the dialog border.
     * @default 2
     */
    readonly paddingX?: number;

    /**
     * Vertical padding inside the dialog border.
     * @default 1
     */
    readonly paddingY?: number;

    /**
     * Override terminal rows. Useful in renderToString or testing contexts
     * where useWindowSize is unavailable.
     */
    readonly rows?: number;

    /**
     * Scrollbar visual style.
     * @default "block"
     */
    readonly scrollbarStyle?:
        | "arrow"
        | "block"
        | "bold"
        | "classic"
        | "dots"
        | "double"
        | "doubleSingle"
        | "line"
        | "round"
        | "single"
        | "singleDouble"
        | "thick";

    /**
     * Ref to the internal ScrollView for programmatic scrolling.
     */
    readonly scrollRef?: React.Ref<ScrollViewRef>;

    /**
     * Title rendered at the top of the dialog. If a string is provided,
     * it is rendered as bold cyan text.
     */
    readonly title?: ReactNode;

    /**
     * Whether the dialog is visible. When `false`, nothing is rendered.
     * @default true
     */
    readonly visible?: boolean;

    /**
     * Dialog width in columns.
     * @default 60
     */
    readonly width?: number;
};

/**
 * A centered overlay dialog with automatic scrolling and scrollbar when
 * content exceeds the available terminal height.
 *
 * Uses the terminal's detected background color by default so the
 * dialog blends with the user's theme.
 *
 * ```tsx
 * &lt;Dialog title="Help" footer={&lt;Text dimColor>Press Esc to close&lt;/Text>}>
 *   &lt;Text>Dialog content here&lt;/Text>
 * &lt;/Dialog>
 * ```
 */
const Dialog = ({
    backgroundColor: backgroundColorProp,
    borderColor = "cyan",
    borderStyle = "round",
    children,
    columns: columnsProp,
    footer,
    maxHeight: maxHeightProp = 0.8,
    paddingX = 2,
    paddingY = 1,
    rows: rowsProp,
    scrollbarStyle: scrollbarStyleProp = "block",
    scrollRef: externalScrollRef,
    title,
    visible = true,
    width = 60,
}: Props): ReactElement | null => {
    // Hooks must be called unconditionally (React rules)
    const windowSize = useWindowSize();
    const { isLoading: paletteLoading, palette } = useTerminalPalette();
    const internalScrollRef = useRef<ScrollViewRef>(null);
    const scrollViewRef = externalScrollRef ?? internalScrollRef;

    if (!visible) {
        return null;
    }

    const cols = columnsProp ?? (windowSize.columns || 80);
    const termRows = rowsProp ?? (windowSize.rows || 24);

    const bg = backgroundColorProp ?? (paletteLoading ? "black" : (palette?.background ?? "black"));

    const resolvedMaxHeight = maxHeightProp <= 1 ? Math.floor(termRows * maxHeightProp) : Math.min(maxHeightProp, termRows - 2);

    const titleElement =
        typeof title === "string" ? (
            <Box marginBottom={1}>
                <Text bold color={borderColor}>
                    {title}
                </Text>
            </Box>
        ) : (
            (title ?? null)
        );
    return (
        <Box alignItems="center" height={termRows} justifyContent="center" position="absolute" width={cols}>
            <Box
                backgroundColor={bg}
                borderBackgroundColor={bg}
                borderColor={borderColor}
                borderStyle={borderStyle}
                flexDirection="column"
                maxHeight={resolvedMaxHeight}
                opaque
                paddingY={paddingY}
                width={Math.min(width, cols - 4)}
            >
                {/* Title — fixed above scroll area */}
                {titleElement != null && (
                    <Box flexShrink={0} paddingX={paddingX}>
                        {titleElement}
                    </Box>
                )}

                {/* Scrollable content with built-in scrollbar */}
                <ScrollView
                    flexGrow={1}
                    flexShrink={1}
                    paddingX={paddingX}
                    ref={scrollViewRef}
                    scrollbar
                    scrollbarColor={borderColor}
                    scrollbarStyle={scrollbarStyleProp}
                >
                    {children}
                </ScrollView>

                {/* Footer — fixed below scroll area */}
                {footer != null && (
                    <Box alignItems="center" flexDirection="column" flexShrink={0} marginTop={1} paddingX={paddingX}>
                        {footer}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Dialog;
