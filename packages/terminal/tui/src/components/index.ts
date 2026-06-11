/**
 * Internal barrel listing every component shipped by `@visulima/tui`.
 *
 * Kept sorted alphabetically by component name so grepping and diffing stays
 * predictable. This file is **not** a public entry point and is not reachable
 * via any subpath export. Consumers must import each component from its own
 * deep subpath (e.g. `@visulima/tui/components/box`) so they only pay for what
 * they use; the bare `@visulima/tui` entry intentionally does not re-export
 * components. This barrel exists only as a maintenance index / type-coverage
 * aid for contributors.
 */
export type { AccordionItem, Props as AccordionProps } from "./accordion";
export { default as Accordion } from "./accordion";
export type { Props as AlertProps, AlertVariant } from "./alert";
export { default as Alert } from "./alert";
export type { Props as AnimatePresenceProps } from "./animate-presence";
export { default as AnimatePresence } from "./animate-presence";
export type { Props as AppProps } from "./app-context";
export type { ApprovalDecision, Props as ApprovalPromptProps, ApprovalRisk } from "./approval-prompt";
export { default as ApprovalPrompt } from "./approval-prompt";
export type { Props as AreaChartProps } from "./area-chart";
export { default as AreaChart } from "./area-chart";
export type { Props as BadgeProps } from "./badge";
export { default as Badge } from "./badge";
export type { Props as BarChartProps, BarDatum } from "./bar-chart";
export { default as BarChart } from "./bar-chart";
export type { Align as BigTextAlign, BackgroundColor as BigTextBackgroundColor, Font as BigTextFont, Props as BigTextProps } from "./big-text";
export { default as BigText } from "./big-text";
export type { Props as BlinkDotProps } from "./blink-dot";
export { default as BlinkDot } from "./blink-dot";
export type { Props as BoxProps } from "./box";
export { default as Box } from "./box";
export type { BreadcrumbItem, Props as BreadcrumbProps } from "./breadcrumb";
export { default as Breadcrumb } from "./breadcrumb";
export type { Props as ButtonProps, ButtonVariant } from "./button";
export { default as Button } from "./button";
export type { Props as CalendarProps } from "./calendar";
export { default as Calendar } from "./calendar";
export type { CanvasColor, CanvasContext, Props as CanvasProps, CellStyle } from "./canvas";
export { default as Canvas } from "./canvas";
export type { Props as CardProps } from "./card";
export { default as Card } from "./card";
export type { Props as CheckboxProps } from "./checkbox";
export { default as Checkbox } from "./checkbox";
export type { Props as CodeProps } from "./code";
export { default as Code } from "./code";
export type { Props as CollapsibleProps } from "./collapsible";
export { default as Collapsible } from "./collapsible";
export type { Props as CommandBlockProps, CommandStatus } from "./command-block";
export { default as CommandBlock } from "./command-block";
export type { CommandEntry, Props as CommandPaletteProps } from "./command-palette";
export { default as CommandPalette } from "./command-palette";
export type { Props as ConfirmDialogProps, ConfirmTone } from "./confirm-dialog";
export { default as ConfirmDialog } from "./confirm-dialog";
export type { Props as ConfirmInputProps } from "./confirm-input";
export { default as ConfirmInput } from "./confirm-input";
export type { ConsoleOverlayDock, Props as ConsoleOverlayProps } from "./console-overlay";
export { default as ConsoleOverlay } from "./console-overlay";
export type { ContentSwitcherOption, Props as ContentSwitcherProps } from "./content-switcher";
export { default as ContentSwitcher } from "./content-switcher";
export type { Props as CursorProps } from "./cursor";
export { default as Cursor } from "./cursor";
export type { Props as DatePickerProps } from "./date-picker";
export { default as DatePicker } from "./date-picker";
export type { DefinitionItem, Props as DefinitionListProps } from "./definition-list";
export { default as DefinitionList } from "./definition-list";
export type { Props as DialogProps } from "./dialog";
export { default as Dialog } from "./dialog";
export type { DiffViewMode, Props as DiffViewProps, InlineDiffMode } from "./diff-view";
export { default as DiffView } from "./diff-view";
export type { Props as DividerProps } from "./divider";
export { default as Divider } from "./divider";
export type { FileEntry, FilePickerFilter, FilePickerProps } from "./file-picker";
export { FilePicker } from "./file-picker";
export type { FormFieldProps, Props as FormProps } from "./form";
export { default as Form, FormField } from "./form";
export type { Props as GaugeProps, GaugeSize, GaugeThreshold } from "./gauge";
export { default as Gauge } from "./gauge";
export type { GradientColors, GradientName, Props as GradientProps } from "./gradient";
export { default as Gradient } from "./gradient";
export type { HeadingLevel, Props as HeadingProps } from "./heading";
export { default as Heading } from "./heading";
export type { HeatmapProps } from "./heatmap";
export { default as Heatmap } from "./heatmap";
export type { Props as HelpProps } from "./help";
export { default as Help } from "./help";
export type { Props as HistogramProps } from "./histogram";
export { default as Histogram } from "./histogram";
export type { Props as KbdProps } from "./kbd";
export { default as Kbd } from "./kbd";
export type { LineChartProps, LineSeries } from "./line-chart";
export { default as LineChart } from "./line-chart";
export type { Props as LinkProps } from "./link";
export { default as Link } from "./link";
export type { Props as LoadingIndicatorProps } from "./loading-indicator";
export { default as LoadingIndicator } from "./loading-indicator";
export type { Props as MarkdownProps } from "./markdown";
export { default as Markdown } from "./markdown";
export type { Props as MaskedInputProps } from "./masked-input";
export { default as MaskedInput } from "./masked-input";
export type { MenuItem, Props as MenuProps, MenuSection } from "./menu";
export { default as Menu } from "./menu";
export type { Props as MessageBubbleProps, MessageRole } from "./message-bubble";
export { default as MessageBubble } from "./message-bubble";
export type { Props as ModelBadgeProps } from "./model-badge";
export { default as ModelBadge } from "./model-badge";
export type { MultiSelectOption, Props as MultiSelectProps } from "./multi-select";
export { default as MultiSelect } from "./multi-select";
export type { Props as NewlineProps } from "./newline";
export { default as Newline } from "./newline";
export type { OperationNode, OperationStatus, Props as OperationTreeProps } from "./operation-tree";
export { default as OperationTree } from "./operation-tree";
export type { OptionListEntry, Props as OptionListProps } from "./option-list";
export { default as OptionList } from "./option-list";
export type { OrderedListEntry, Props as OrderedListProps } from "./ordered-list";
export { default as OrderedList } from "./ordered-list";
export type { PageMeta, Props as PaginatorProps } from "./paginator";
export { default as Paginator } from "./paginator";
export type { Props as ParagraphProps } from "./paragraph";
export { default as Paragraph } from "./paragraph";
export type { Props as PlaceholderProps } from "./placeholder";
export { default as Placeholder } from "./placeholder";
export type { Props as ProgressBarProps } from "./progress-bar";
export { default as ProgressBar } from "./progress-bar";
export type { Props as RadioGroupProps, RadioOption } from "./radio-group";
export { default as RadioGroup } from "./radio-group";
export type { Props as ScatterPlotProps } from "./scatter-plot";
export { default as ScatterPlot } from "./scatter-plot";
export type {
    ControlledScrollViewProps,
    ControlledScrollViewRef,
    ScrollAlignment,
    ScrollBarBoxProps,
    ScrollBarPlacement,
    ScrollBarProps,
    ScrollBarStyle,
    ScrollListProps,
    ScrollListRef,
    ScrollViewProps,
    ScrollViewRef,
} from "./scroll";
export { ControlledScrollView, ScrollBar, ScrollBarBox, ScrollList, ScrollView } from "./scroll";
export type { Props as SearchInputProps } from "./search-input";
export { default as SearchInput } from "./search-input";
export type { SelectInputEntry, Item as SelectInputItemType, Props as SelectInputProps, SeparatorItem as SelectInputSeparator } from "./select-input";
export { default as SelectInput } from "./select-input";
export type { Props as SelectInputIndicatorProps } from "./select-input-indicator";
export { default as SelectInputIndicator } from "./select-input-indicator";
export type { Props as SelectInputItemProps } from "./select-input-item";
export { default as SelectInputItem } from "./select-input-item";
export type { Props as ShimmerTextProps } from "./shimmer-text";
export { default as ShimmerText } from "./shimmer-text";
export type { Props as SliderProps } from "./slider";
export { default as Slider } from "./slider";
export { default as Spacer } from "./spacer";
export type { Props as SparklineProps } from "./sparkline";
export { default as Sparkline } from "./sparkline";
export type { Props as SpinnerProps } from "./spinner";
export { default as Spinner } from "./spinner";
export type { Props as StaticProps } from "./static";
export { default as Static } from "./static";
export type { Props as StaticRenderProps } from "./static-render";
export { default as StaticRender } from "./static-render";
export type { Props as StatusLineProps } from "./status-line";
export { default as StatusLine } from "./status-line";
export type { Props as StatusMessageProps, StatusMessageVariant } from "./status-message";
export { default as StatusMessage } from "./status-message";
export type { Props as StderrProps } from "./stderr-context";
export type { PublicProps as StdinProps } from "./stdin-context";
export type { Props as StdoutProps } from "./stdout-context";
export type { Props as StepperProps, StepperStep, StepStatus } from "./stepper";
export { default as Stepper } from "./stepper";
export type { Props as StopwatchProps, StopwatchRef } from "./stopwatch";
export { default as Stopwatch } from "./stopwatch";
export type { Props as StreamingTextProps } from "./streaming-text";
export { default as StreamingText } from "./streaming-text";
export type { Props as SwitchProps } from "./switch";
export { default as Switch } from "./switch";
export type { Props as TabProps } from "./tab";
export { default as Tab } from "./tab";
export type { ColumnConfig as TableColumnConfig, Props as TableProps, Scalar as TableScalar, ScalarDict as TableScalarDict } from "./table";
export { default as Table } from "./table";
export type { TabColors, KeyMap as TabsKeyMap, Props as TabsProps } from "./tabs";
export { default as Tabs } from "./tabs";
export type { Props as TagProps, TagVariant } from "./tag";
export { default as Tag } from "./tag";
export type { Props as TextProps } from "./text";
export { default as Text } from "./text";
export type { Props as TextInputProps } from "./text-input";
export { default as TextInput } from "./text-input";
export type { Props as TextareaProps } from "./textarea";
export { default as Textarea } from "./textarea";
export type { Props as TimerProps, TimerRef } from "./timer";
export { default as Timer } from "./timer";
export type { Props as ToastProps, ToastVariant } from "./toast";
export { default as Toast } from "./toast";
export type { TooltipPlacement, Props as TooltipProps } from "./tooltip";
export { default as Tooltip } from "./tooltip";
export type { Props as TransformProps } from "./transform";
export { default as Transform } from "./transform";
export type { TransitionPhase, TransitionPreset, Props as TransitionProps } from "./transition";
export { default as Transition } from "./transition";
export type {
    AsyncChildrenFunction,
    FlatNode,
    SelectionMode,
    TreeNode,
    TreeNodeRendererProps,
    TreeNodeState,
    TreeViewProps,
    TreeViewState,
    TreeViewTheme,
    UseTreeViewProps,
    UseTreeViewStateProps,
} from "./tree-view";
export { TreeNodeMap, TreeView, treeViewTheme, useTreeView, useTreeViewState } from "./tree-view";
export type { UnorderedListEntry, Props as UnorderedListProps } from "./unordered-list";
export { default as UnorderedList } from "./unordered-list";
