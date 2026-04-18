/**
 * Public API for the `@visulima/tui` ink entry point.
 *
 * The bulk of the component and hook surface lives in dedicated barrels
 * (`./components`, `./hooks`) — this file re-exports those and adds the
 * lower-level primitives (DOM helpers, renderers, mouse, layout, …) that
 * don't fit either category.
 */

// --- Component & hook barrels -----------------------------------------------

export type { ClipboardTarget } from "./clipboard";
export { clearOsc52, isOsc52Supported, writeOsc52 } from "./clipboard";

// --- Clipboard --------------------------------------------------------------

export type { ColorBlindnessType, ColorMatrix } from "./color-matrix";
export {
    applyColorMatrix,
    COLOR_BLINDNESS_COMPENSATION,
    COLOR_BLINDNESS_SIMULATION,
    hexToRgb,
    IDENTITY_MATRIX,
    rgbToHex,
    transformHexColor,
} from "./color-matrix";

// --- Color primitives -------------------------------------------------------

// --- Components (inlined to avoid packem barrel bundling issue) -------------

export type { AccordionItem, Props as AccordionProps } from "./components/accordion";
export { default as Accordion } from "./components/accordion";
export type { Props as AlertProps, AlertVariant } from "./components/alert";
export { default as Alert } from "./components/alert";
export type { Props as AnimatePresenceProps } from "./components/animate-presence";
export { default as AnimatePresence } from "./components/animate-presence";
export type { Props as AppProps } from "./components/app-context";
export type { ApprovalDecision, Props as ApprovalPromptProps, ApprovalRisk } from "./components/approval-prompt";
export { default as ApprovalPrompt } from "./components/approval-prompt";
export type { Props as AreaChartProps } from "./components/area-chart";
export { default as AreaChart } from "./components/area-chart";
export type { Props as BadgeProps } from "./components/badge";
export { default as Badge } from "./components/badge";
export type { Props as BarChartProps, BarDatum } from "./components/bar-chart";
export { default as BarChart } from "./components/bar-chart";
export type { Align as BigTextAlign, BackgroundColor as BigTextBackgroundColor, Font as BigTextFont, Props as BigTextProps } from "./components/big-text";
export { default as BigText } from "./components/big-text";
export type { Props as BlinkDotProps } from "./components/blink-dot";
export { default as BlinkDot } from "./components/blink-dot";
export type { Props as BoxProps } from "./components/box";
export { default as Box } from "./components/box";
export type { BreadcrumbItem, Props as BreadcrumbProps } from "./components/breadcrumb";
export { default as Breadcrumb } from "./components/breadcrumb";
export type { Props as ButtonProps, ButtonVariant } from "./components/button";
export { default as Button } from "./components/button";
export type { Props as CalendarProps } from "./components/calendar";
export { default as Calendar } from "./components/calendar";
export type { CanvasColor, CanvasContext, Props as CanvasProps, CellStyle } from "./components/canvas";
export { default as Canvas } from "./components/canvas";
export type { Props as CardProps } from "./components/card";
export { default as Card } from "./components/card";
export type { Props as CheckboxProps } from "./components/checkbox";
export { default as Checkbox } from "./components/checkbox";
export type { Props as CodeProps } from "./components/code";
export { default as Code } from "./components/code";
export type { Props as CollapsibleProps } from "./components/collapsible";
export { default as Collapsible } from "./components/collapsible";
export type { Props as CommandBlockProps, CommandStatus } from "./components/command-block";
export { default as CommandBlock } from "./components/command-block";
export type { CommandEntry, Props as CommandPaletteProps } from "./components/command-palette";
export { default as CommandPalette } from "./components/command-palette";
export type { Props as ConfirmDialogProps, ConfirmTone } from "./components/confirm-dialog";
export { default as ConfirmDialog } from "./components/confirm-dialog";
export type { Props as ConfirmInputProps } from "./components/confirm-input";
export { default as ConfirmInput } from "./components/confirm-input";
export type { ConsoleOverlayDock, Props as ConsoleOverlayProps } from "./components/console-overlay";
export { default as ConsoleOverlay } from "./components/console-overlay";
export type { ContentSwitcherOption, Props as ContentSwitcherProps } from "./components/content-switcher";
export { default as ContentSwitcher } from "./components/content-switcher";
export type { Props as CursorProps } from "./components/cursor";
export { default as Cursor } from "./components/cursor";
export type { Props as DatePickerProps } from "./components/date-picker";
export { default as DatePicker } from "./components/date-picker";
export type { DefinitionItem, Props as DefinitionListProps } from "./components/definition-list";
export { default as DefinitionList } from "./components/definition-list";
export type { Props as DialogProps } from "./components/dialog";
export { default as Dialog } from "./components/dialog";
export type { DiffViewMode, Props as DiffViewProps, InlineDiffMode } from "./components/diff-view";
export { default as DiffView } from "./components/diff-view";
export type { Props as DividerProps } from "./components/divider";
export { default as Divider } from "./components/divider";
export type { Props as FilePickerProps } from "./components/file-picker/file-picker";
export { default as FilePicker } from "./components/file-picker/file-picker";
export type { FileEntry, FilePickerFilter } from "./components/file-picker/types";
export type { FormFieldProps, Props as FormProps } from "./components/form";
export { default as Form, FormField } from "./components/form";
export type { Props as GaugeProps, GaugeSize, GaugeThreshold } from "./components/gauge";
export { default as Gauge } from "./components/gauge";
export type { GradientColors, GradientName, Props as GradientProps } from "./components/gradient";
export { default as Gradient } from "./components/gradient";
export type { HeadingLevel, Props as HeadingProps } from "./components/heading";
export { default as Heading } from "./components/heading";
export type { HeatmapProps } from "./components/heatmap";
export { default as Heatmap } from "./components/heatmap";
export type { Props as HelpProps } from "./components/help";
export { default as Help } from "./components/help";
export type { Props as HistogramProps } from "./components/histogram";
export { default as Histogram } from "./components/histogram";
export type { Props as KbdProps } from "./components/kbd";
export { default as Kbd } from "./components/kbd";
export type { LineChartProps, LineSeries } from "./components/line-chart";
export { default as LineChart } from "./components/line-chart";
export type { Props as LinkProps } from "./components/link";
export { default as Link } from "./components/link";
export type { Props as LoadingIndicatorProps } from "./components/loading-indicator";
export { default as LoadingIndicator } from "./components/loading-indicator";
export type { Props as MarkdownProps } from "./components/markdown";
export { default as Markdown } from "./components/markdown";
export type { Props as MaskedInputProps } from "./components/masked-input";
export { default as MaskedInput } from "./components/masked-input";
export type { MenuItem, Props as MenuProps, MenuSection } from "./components/menu";
export { default as Menu } from "./components/menu";
export type { Props as MessageBubbleProps, MessageRole } from "./components/message-bubble";
export { default as MessageBubble } from "./components/message-bubble";
export type { Props as ModelBadgeProps } from "./components/model-badge";
export { default as ModelBadge } from "./components/model-badge";
export type { MultiSelectOption, Props as MultiSelectProps } from "./components/multi-select";
export { default as MultiSelect } from "./components/multi-select";
export type { Props as NewlineProps } from "./components/newline";
export { default as Newline } from "./components/newline";
export type { OperationNode, OperationStatus, Props as OperationTreeProps } from "./components/operation-tree";
export { default as OperationTree } from "./components/operation-tree";
export type { OptionListEntry, Props as OptionListProps } from "./components/option-list";
export { default as OptionList } from "./components/option-list";
export type { OrderedListEntry, Props as OrderedListProps } from "./components/ordered-list";
export { default as OrderedList } from "./components/ordered-list";
export type { PageMeta, Props as PaginatorProps } from "./components/paginator";
export { default as Paginator } from "./components/paginator";
export type { Props as ParagraphProps } from "./components/paragraph";
export { default as Paragraph } from "./components/paragraph";
export type { Props as PlaceholderProps } from "./components/placeholder";
export { default as Placeholder } from "./components/placeholder";
export type { Props as ProgressBarProps } from "./components/progress-bar";
export { default as ProgressBar } from "./components/progress-bar";
export type { Props as RadioGroupProps, RadioOption } from "./components/radio-group";
export { default as RadioGroup } from "./components/radio-group";
export type { Props as ScatterPlotProps } from "./components/scatter-plot";
export { default as ScatterPlot } from "./components/scatter-plot";
export type { ControlledScrollViewProps, ControlledScrollViewRef } from "./components/scroll/controlled-scroll-view";
export { ControlledScrollView } from "./components/scroll/controlled-scroll-view";
export type { ScrollBarPlacement, ScrollBarProps, ScrollBarStyle } from "./components/scroll/scroll-bar";
export { ScrollBar } from "./components/scroll/scroll-bar";
export type { ScrollBarBoxProps } from "./components/scroll/scroll-bar-box";
export { ScrollBarBox } from "./components/scroll/scroll-bar-box";
export type { ScrollAlignment, ScrollListProps, ScrollListRef } from "./components/scroll/scroll-list";
export { ScrollList } from "./components/scroll/scroll-list";
export type { ScrollViewProps, ScrollViewRef } from "./components/scroll/scroll-view";
export { ScrollView } from "./components/scroll/scroll-view";
export type { Props as SearchInputProps } from "./components/search-input";
export { default as SearchInput } from "./components/search-input";
export type {
    SelectInputEntry,
    Item as SelectInputItemType,
    Props as SelectInputProps,
    SeparatorItem as SelectInputSeparator,
} from "./components/select-input";
export { default as SelectInput } from "./components/select-input";
export type { Props as SelectInputIndicatorProps } from "./components/select-input-indicator";
export { default as SelectInputIndicator } from "./components/select-input-indicator";
export type { Props as SelectInputItemProps } from "./components/select-input-item";
export { default as SelectInputItem } from "./components/select-input-item";
export type { Props as ShimmerTextProps } from "./components/shimmer-text";
export { default as ShimmerText } from "./components/shimmer-text";
export type { Props as SliderProps } from "./components/slider";
export { default as Slider } from "./components/slider";
export { default as Spacer } from "./components/spacer";
export type { Props as SparklineProps } from "./components/sparkline";
export { default as Sparkline } from "./components/sparkline";
export type { Props as SpinnerProps } from "./components/spinner";
export { default as Spinner } from "./components/spinner";
export type { Props as StaticProps } from "./components/static";
export { default as Static } from "./components/static";
export type { Props as StaticRenderProps } from "./components/static-render";
export { default as StaticRender } from "./components/static-render";
export type { Props as StatusLineProps } from "./components/status-line";
export { default as StatusLine } from "./components/status-line";
export type { Props as StatusMessageProps, StatusMessageVariant } from "./components/status-message";
export { default as StatusMessage } from "./components/status-message";
export type { Props as StderrProps } from "./components/stderr-context";
export type { PublicProps as StdinProps } from "./components/stdin-context";
export type { Props as StdoutProps } from "./components/stdout-context";
export type { Props as StepperProps, StepperStep, StepStatus } from "./components/stepper";
export { default as Stepper } from "./components/stepper";
export type { Props as StopwatchProps, StopwatchRef } from "./components/stopwatch";
export { default as Stopwatch } from "./components/stopwatch";
export type { Props as StreamingTextProps } from "./components/streaming-text";
export { default as StreamingText } from "./components/streaming-text";
export type { Props as SwitchProps } from "./components/switch";
export { default as Switch } from "./components/switch";
export type { Props as TabProps } from "./components/tab";
export { default as Tab } from "./components/tab";
export type { ColumnConfig as TableColumnConfig, Props as TableProps, Scalar as TableScalar, ScalarDict as TableScalarDict } from "./components/table";
export { default as Table } from "./components/table";
export type { TabColors, KeyMap as TabsKeyMap, Props as TabsProps } from "./components/tabs";
export { default as Tabs } from "./components/tabs";
export type { Props as TagProps, TagVariant } from "./components/tag";
export { default as Tag } from "./components/tag";
export type { Props as TextProps } from "./components/text";
export { default as Text } from "./components/text";
export type { Props as TextInputProps } from "./components/text-input";
export { default as TextInput } from "./components/text-input";
export type { Props as TextareaProps } from "./components/textarea";
export { default as Textarea } from "./components/textarea";
export type { Props as TimerProps, TimerRef } from "./components/timer";
export { default as Timer } from "./components/timer";
export type { Props as ToastProps, ToastVariant } from "./components/toast";
export { default as Toast } from "./components/toast";
export type { TooltipPlacement, Props as TooltipProps } from "./components/tooltip";
export { default as Tooltip } from "./components/tooltip";
export type { Props as TransformProps } from "./components/transform";
export { default as Transform } from "./components/transform";
export type { TransitionPhase, TransitionPreset, Props as TransitionProps } from "./components/transition";
export { default as Transition } from "./components/transition";
export type { Theme as TreeViewTheme } from "./components/tree-view/theme";
export { theme as treeViewTheme } from "./components/tree-view/theme";
export type { FlatNode } from "./components/tree-view/tree-node-map";
export { TreeNodeMap } from "./components/tree-view/tree-node-map";
export type { Props as TreeViewProps } from "./components/tree-view/tree-view";
export { TreeView } from "./components/tree-view/tree-view";
export type { AsyncChildrenFunction, SelectionMode, TreeNode, TreeNodeRendererProps, TreeNodeState } from "./components/tree-view/types";
export type { UseTreeViewProps } from "./components/tree-view/use-tree-view";
export { useTreeView } from "./components/tree-view/use-tree-view";
export type { TreeViewState, UseTreeViewStateProps } from "./components/tree-view/use-tree-view-state";
export { useTreeViewState } from "./components/tree-view/use-tree-view-state";
export type { UnorderedListEntry, Props as UnorderedListProps } from "./components/unordered-list";
export { default as UnorderedList } from "./components/unordered-list";
export type { DOMElement, StickyHeader } from "./dom";

// --- DOM helpers ------------------------------------------------------------

export { getPathToRoot, isNodeSelectable } from "./dom";

// --- Hooks (inlined to avoid packem barrel bundling issue) ------------------

export type { AnimationResult } from "./hooks/use-animation";
export { default as useAnimation } from "./hooks/use-animation";
export { default as useApp } from "./hooks/use-app";
export type { BoxMetrics, UseBoxMetricsResult } from "./hooks/use-box-metrics";
export { default as useBoxMetrics } from "./hooks/use-box-metrics";
export type { UseClipboardOptions, UseClipboardResult } from "./hooks/use-clipboard";
export { default as useClipboard } from "./hooks/use-clipboard";
export type { UseColorBlindnessOptions, UseColorBlindnessResult } from "./hooks/use-color-blindness";
export { default as useColorBlindness } from "./hooks/use-color-blindness";
export type { ConsoleEntry, ConsoleLevel, UseConsoleCaptureOptions, UseConsoleCaptureResult } from "./hooks/use-console-capture";
export { default as useConsoleCapture } from "./hooks/use-console-capture";
export { default as useCursor } from "./hooks/use-cursor";
export { default as useFocus } from "./hooks/use-focus";
export { default as useFocusManager } from "./hooks/use-focus-manager";
export type { FieldConfig, FieldValidator, FormSchema, FormValues, UseFormOptions, UseFormResult, ValidationResult } from "./hooks/use-form";
export { default as useForm } from "./hooks/use-form";
export type { HotkeyDescriptor, UseHotkeyOptions } from "./hooks/use-hotkey";
export { default as useHotkey } from "./hooks/use-hotkey";
export type { Key } from "./hooks/use-input";
export { default as useInput } from "./hooks/use-input";
export type { UseIntervalOptions, UseIntervalResult } from "./hooks/use-interval";
export { default as useInterval } from "./hooks/use-interval";
export { default as useIsScreenReaderEnabled } from "./hooks/use-is-screen-reader-enabled";
export type { KeyBinding, KeyBindingHandler } from "./hooks/use-key-bindings";
export { default as useKeyBindings } from "./hooks/use-key-bindings";
export type { KeyChordStep, UseKeyChordOptions } from "./hooks/use-key-chord";
export { default as useKeyChord } from "./hooks/use-key-chord";
export type { LinkedScrollGroup, UseLinkedScrollReturn } from "./hooks/use-linked-scroll";
export { default as createLinkedScrollGroup } from "./hooks/use-linked-scroll";
export { default as usePaste } from "./hooks/use-paste";
export type { PersistentStorage, UsePersistentStateOptions } from "./hooks/use-persistent-state";
export { createFileStorage, createMemoryStorage, default as usePersistentState } from "./hooks/use-persistent-state";
export type { UseScrollAccelerationOptions, UseScrollAccelerationResult } from "./hooks/use-scroll-acceleration";
export { default as useScrollAcceleration } from "./hooks/use-scroll-acceleration";
export type { UseScrollInputOptions, UseScrollInputReturn } from "./hooks/use-scroll-input";
export { default as useScrollInput } from "./hooks/use-scroll-input";
export { default as useStderr } from "./hooks/use-stderr";
export { default as useStdin } from "./hooks/use-stdin";
export { default as useStdout } from "./hooks/use-stdout";
export type { UseStopwatchOptions, UseStopwatchResult } from "./hooks/use-stopwatch";
export { default as useStopwatch } from "./hooks/use-stopwatch";
export type { UseTerminalPaletteResult } from "./hooks/use-terminal-palette";
export { default as useTerminalPalette } from "./hooks/use-terminal-palette";
export type { CursorPosition as TextBufferCursorPosition, TextBufferState, UseTextBufferResult } from "./hooks/use-text-buffer";
export { default as useTextBuffer } from "./hooks/use-text-buffer";
export type { UseTextSelectionOptions, UseTextSelectionResult } from "./hooks/use-text-selection";
export { default as useTextSelection } from "./hooks/use-text-selection";
export type { UseTimeoutOptions, UseTimeoutResult } from "./hooks/use-timeout";
export { default as useTimeout } from "./hooks/use-timeout";
export type { UseTimerOptions, UseTimerResult } from "./hooks/use-timer";
export { default as useTimer } from "./hooks/use-timer";
export type { WindowSize } from "./hooks/use-window-size";
export { default as useWindowSize } from "./hooks/use-window-size";

// --- IME --------------------------------------------------------------------

export { IMECompositionBuffer, isIMEInput } from "./ime-utils";

// --- Kitty keyboard ---------------------------------------------------------

export type { KittyFlagName, KittyKeyboardOptions } from "./kitty-keyboard";
export { kittyFlags, kittyModifiers } from "./kitty-keyboard";

// --- Layout -----------------------------------------------------------------

export type { LayoutCallbacks } from "./layout";
export { processLayout } from "./layout";
export type { CursorPosition } from "./log-update";

// --- Measurement ------------------------------------------------------------

export type { ScrollbarBoundingBox, TextFragment } from "./measure-element";
export { default as measureElement } from "./measure-element";
export {
    calculateScrollbarLayout,
    calculateScrollbarThumb,
    collectSortedFragments,
    getAddedScrollHeight,
    getBoundingBox,
    getHorizontalScrollbarBoundingBox,
    getInnerHeight,
    getInnerWidth,
    getRelativeLeft,
    getRelativeTop,
    getText,
    getVerticalScrollbarBoundingBox,
} from "./measure-element";
export type { StringWidthFunction } from "./measure-text";
export { clearStringWidthCache, clearStyledLineCache, inkCharacterWidth, setEnableStyledLineCache, setStringWidthFunction, toStyledLine } from "./measure-text";

// --- Mouse ------------------------------------------------------------------

export type {
    MouseAction,
    MouseButton,
    MouseClickAction,
    MouseContextShape,
    MouseDragAction,
    MouseEvents,
    MousePosition,
    MouseScrollAction,
    SgrMouseEvent,
    UseOnMouseClickOptions,
} from "./mouse/index";
export {
    Fullscreen,
    isIntersecting,
    MouseProvider,
    parseSgrMouse,
    useElementDimensions,
    useElementPosition,
    useMouseAction,
    useMouseContext,
    useMousePosition,
    useOnMouseClick,
    useOnMouseHover,
    useOnMouseState,
} from "./mouse/index";

// --- Render & output --------------------------------------------------------

export type { Instance, RenderOptions } from "./render";
export { default as render } from "./render";
export type { RenderToStringOptions } from "./render-to-string";
export { default as renderToString } from "./render-to-string";
export type { ResizeObserverCallback } from "./resize-observer";
export { default as ResizeObserver, ResizeObserverEntry } from "./resize-observer";

// --- Scroll & selection -----------------------------------------------------

export type { ScrollState } from "./scroll";
export { calculateScroll, getScrollHeight, getScrollLeft, getScrollTop, getScrollWidth } from "./scroll";
export { applySelectionToStyledLine, comparePoints, Range, Selection } from "./selection";
export type { CharOffsetMap, CharOffsetRange } from "./squash-text-nodes";
export { squashTextNodesWithMap } from "./squash-text-nodes";

// --- Terminal palette / text ------------------------------------------------

export type { TerminalPalette } from "./terminal-palette";
export { isTerminalPaletteQuerySupported, queryTerminalPalette } from "./terminal-palette";
export { wrapOrTruncateStyledLine } from "./text-wrap";
