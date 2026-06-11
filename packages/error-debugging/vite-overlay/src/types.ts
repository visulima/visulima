import type { ErrorLocation } from "@visulima/error/error";
import type { Solution, SolutionFinder } from "@visulima/error/solution";
import type { Properties as CSSProperties } from "csstype";

export type { Solution, SolutionFinder } from "@visulima/error/solution";

/**
 * Framework hint used to route framework-aware solutions. When omitted, the plugin
 * auto-detects the framework from the configured Vite plugins.
 */
export type Framework = "preact" | "react" | "solid" | "svelte" | "vue";

export type ErrorLike = Error | { message?: string; name?: string; stack?: string };

export interface PluginPattern {
    readonly name: string;
    readonly pattern: RegExp;
}

export type SupportedExtension = ".js" | ".ts" | ".mjs" | ".cjs" | ".jsx" | ".tsx" | ".vue" | ".svelte";

export interface StackLocation {
    readonly column?: number;
    readonly file?: string;
    readonly line?: number;
}

export interface VisulimaViteOverlayErrorPayload {
    readonly errors: ReadonlyArray<ExtendedError>;
    readonly errorType: "client" | "server";
    readonly rootPath: string;
    readonly solution?: Solution;
}

export interface ExtendedError extends ErrorProcessingResult {
    readonly hint?: string;
    readonly message: string;
    readonly name: string;
    readonly stack: string;
}

export interface DevelopmentLogger {
    readonly error: (message: unknown) => void;
    readonly log: (message: unknown) => void;
}

export interface RecentErrorTracker {
    readonly recentErrors: Map<string, number>;
    readonly shouldSkip: (signature: string) => boolean;
}

export interface RawErrorData {
    readonly cause?: {
        readonly cause?: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            readonly cause?: any;
            readonly message?: string | null;
            readonly name?: string | null;
            readonly stack?: string | null;
        } | null;
        readonly message?: string | null;
        readonly name?: string | null;
        readonly stack?: string | null;
    } | null;
    readonly column?: number | null;
    readonly file?: string | null;
    readonly line?: number | null;
    readonly message: string;
    readonly name?: string;
    readonly ownerStack?: string | null;
    readonly plugin?: string;
    readonly stack: string;
}

export interface VueErrorInfo {
    readonly column: number;
    readonly line: number;
    readonly message?: string;
    readonly originalFilePath: string;
}

export type ViteErrorData = ErrorLocation & {
    plugin?: string;
};

export interface ResolvedLocation {
    readonly originalFileColumn: number;
    readonly originalFileLine: number;
    readonly originalFilePath: string;
}

export interface SourceTexts {
    readonly compiledSourceText?: string;
    readonly originalSourceText?: string;
}

export interface ErrorProcessingResult {
    readonly compiledCodeFrameContent?: string;
    readonly compiledColumn?: number;
    readonly compiledFilePath?: string;
    readonly compiledLine?: number;
    readonly compiledStack?: string;
    readonly errorCount?: number;
    readonly fixPrompt: string;
    readonly message?: string;
    readonly originalCodeFrameContent?: string;
    readonly originalFileColumn: number;
    readonly originalFileLine: number;
    readonly originalFilePath: string;
    readonly originalSnippet: string;
    readonly originalStack?: string;
    readonly plugin?: string;
}

export type StackFrameValidator = (line: string) => boolean;

/**
 * Balloon position options
 */
export type BalloonPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Custom style options for the balloon trigger
 * Can be either a CSS string or a CSS.Properties object
 */
export type BalloonStyle = string | CSSProperties;

/**
 * Balloon configuration options
 */
export interface BalloonConfig {
    readonly enabled?: boolean;
    readonly icon?: string;
    readonly position?: BalloonPosition;
    readonly style?: BalloonStyle;
}

/**
 * Overlay configuration options
 */
export interface OverlayConfig {
    readonly balloon?: BalloonConfig;

    /**
     * Custom CSS to inject into the overlay for styling customization.
     * This CSS will be injected into the shadow DOM and can be used to override
     * the default styles of the overlay and button elements.
     * Can be either a CSS string or a CSS.Properties object.
     */
    readonly customCSS?: string | CSSProperties;
}

/**
 * Options accepted by the `@visulima/vite-overlay` plugin.
 */
export interface VisulimaViteOverlayOptions {
    /**
     * Whether client runtime errors are forwarded to (and displayed in) the overlay.
     * @default true
     */
    readonly forwardConsole?: boolean;

    /**
     * Console method names to forward from the client (e.g. `["error", "warn"]`).
     * @default ["error"]
     */
    readonly forwardedConsoleMethods?: string[];

    /**
     * Explicitly set the framework used for framework-aware hints. When omitted, the plugin
     * auto-detects React / Vue / Svelte / Preact / Solid from the configured Vite plugins.
     */
    readonly framework?: Framework;

    /**
     * Capture process-wide `unhandledRejection` events and render them in the overlay.
     * Set to `false` to leave Node's default crash semantics untouched (useful when other
     * tooling in the dev process produces unrelated rejections).
     * @default true
     */
    readonly interceptUnhandledRejection?: boolean;

    /**
     * @deprecated Use {@link VisulimaViteOverlayOptions.forwardConsole} instead.
     */
    readonly logClientRuntimeError?: boolean;

    /**
     * Overlay UI configuration (balloon button, custom CSS).
     */
    readonly overlay?: OverlayConfig;

    /**
     * Custom Preact plugin name to match during auto-detection.
     */
    readonly preactPluginName?: string;

    /**
     * Custom React plugin name to match during auto-detection.
     */
    readonly reactPluginName?: string;

    /**
     * @deprecated Misspelling of {@link VisulimaViteOverlayOptions.showBalloonButton}. Kept for
     * backward compatibility; prefer `showBalloonButton` or `overlay.balloon.enabled`.
     */
    readonly showBallonButton?: boolean;

    /**
     * Whether to show the balloon button.
     * @default true
     */
    readonly showBalloonButton?: boolean;

    /**
     * Custom Solid plugin name to match during auto-detection.
     */
    readonly solidPluginName?: string;

    /**
     * Custom solution finders to run before the built-in finders.
     */
    readonly solutionFinders?: SolutionFinder[];

    /**
     * Custom Svelte plugin name to match during auto-detection.
     */
    readonly sveltePluginName?: string;

    /**
     * Custom Vue plugin name to match during auto-detection.
     */
    readonly vuePluginName?: string;
}
