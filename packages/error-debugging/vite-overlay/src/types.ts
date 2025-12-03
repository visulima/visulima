import type { ErrorLocation } from "@visulima/error/error";
import type { Solution } from "@visulima/error/solution";
import type { Properties as CSSProperties } from "csstype";

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
