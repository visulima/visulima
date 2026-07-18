// fallow-ignore-file unused-type -- intentional maintenance-index barrel; re-exports are consumed via per-component subpath entries, not internally.
// fallow-ignore-file unused-export -- intentional maintenance-index barrel; re-exports are consumed via per-component subpath entries, not internally.

export type { Props as AppProps } from "./app-context";
export type { Props as BoxProps } from "./box";
export { default as Box } from "./box";
export type { CanvasColor, CanvasContext, Props as CanvasProps, CellStyle } from "./canvas";
export { default as Canvas } from "./canvas";
export type { Props as CursorProps } from "./cursor";
export { default as Cursor } from "./cursor";
export type { ErrorBoundaryProps } from "./error-boundary";
export { default as ErrorBoundary } from "./error-boundary";
export type { ErrorOverviewProps } from "./error-overview";
export { default as ErrorOverview } from "./error-overview";
export type { Props as NewlineProps } from "./newline";
export { default as Newline } from "./newline";
export { default as Spacer } from "./spacer";
export type { Props as StaticProps } from "./static";
export { default as Static } from "./static";
export type { Props as StaticRenderProps } from "./static-render";
export { default as StaticRender } from "./static-render";
export type { Props as StderrProps } from "./stderr-context";
export type { PublicProps as StdinProps } from "./stdin-context";
export type { Props as StdoutProps } from "./stdout-context";
export type { Props as TextProps } from "./text";
export { default as Text } from "./text";
export type { Props as TransformProps } from "./transform";
export { default as Transform } from "./transform";
