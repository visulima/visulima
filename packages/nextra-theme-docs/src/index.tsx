import type { DocumentationThemeConfig, RecursivePartial } from "./types";

type PartialDocumentsThemeConfig = RecursivePartial<DocumentationThemeConfig>;

export type { PartialDocumentsThemeConfig as DocumentationThemeConfig };

export { useMDXComponents } from "@mdx-js/react";
export { useTheme } from "next-themes";
export { default as Bleed } from "./components/bleed";
export { default as Callout } from "./components/callout";
export { default as Collapse } from "./components/collapse";
export { default as NotFoundPage } from "./components/not-found";
export { default as ServerSideErrorPage } from "./components/server-side-error";
export { Tabs, Tab } from "./components/tabs";
export { default as Navbar } from "./components/navbar";
export { default as ThemeSwitch } from "./components/theme-switch";
export { default as Anchor } from "./components/anchor";
export { default as Prose } from "./components/prose";
export { default as StepContainer } from "./components/step-container";

export { useConfig } from "./contexts";

export { default } from "./theme";
