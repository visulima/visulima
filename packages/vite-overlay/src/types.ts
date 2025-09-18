import type { ErrorLocation } from "@visulima/error/error";

export type ErrorLike = Error | { message?: string; name?: string; stack?: string };

// Plugin and framework detection
export interface PluginPattern {
    readonly name: string;
    readonly pattern: RegExp;
}

// File extension types
export type SupportedExtension = ".js" | ".ts" | ".mjs" | ".cjs" | ".jsx" | ".tsx" | ".vue" | ".svelte";

// Stack frame location information
export interface StackLocation {
    readonly column?: number;
    readonly file?: string;
    readonly line?: number;
}

export interface VisulimaViteOverlayErrorPayload {
    readonly errors: ReadonlyArray<ExtendedError>;
    readonly errorType: "client" | "server";
    readonly rootPath: string;
}

// Individual error cause with detailed debugging information
export interface ExtendedError {
    readonly compiledCodeFrameContent?: string;
    readonly compiledColumn?: number;
    readonly compiledFilePath?: string;
    readonly compiledLine?: number;
    readonly compiledSnippet?: string;
    readonly fixPrompt?: string;
    readonly originalCodeFrameContent?: string;
    readonly originalFileColumn?: number;
    readonly originalFileLine?: number;
    readonly originalFilePath?: string;
    readonly originalSnippet?: string;
}

// Development server logging interface
export interface DevelopmentLogger {
    readonly error: (message: unknown) => void;
    readonly log: (message: unknown) => void;
}

// Error deduplication and rate limiting
export interface RecentErrorTracker {
    readonly recentErrors: Map<string, number>;
    readonly shouldSkip: (signature: string) => boolean;
}

// Raw error data from client-side error reporting
export interface RawErrorData {
    readonly cause?: {
        readonly cause?: {
            readonly cause?: any; // Recursive nested structure
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

// Vue SFC compilation error information
export interface VueErrorInfo {
    readonly column: number;
    readonly line: number;
    readonly message?: string;
    readonly originalFilePath: string;
}

export type ViteErrorData = ErrorLocation & {
    plugin?: string;
};

// Source map resolution results
export interface ResolvedLocation {
    readonly originalFileColumn: number;
    readonly originalFileLine: number;
    readonly originalFilePath: string;
}

// Module matching and scoring
export interface ModuleMatch<T = any> {
    readonly module: T;
    readonly score: number;
}

// Source text retrieval results
export interface SourceTexts {
    readonly compiledSourceText?: string;
    readonly originalSourceText?: string;
}

// ESBuild error message format
export interface ESBuildMessage {
    readonly location?: {
        readonly column: number;
        readonly file: string;
        readonly line: number;
    };
    readonly pluginName?: string;
    readonly text: string;
}

export interface ErrorProcessingResult {
    readonly compiledCodeFrameContent?: string;
    readonly compiledColumn: number;
    readonly compiledFilePath: string;
    readonly compiledLine: number;
    readonly compiledSnippet: string;
    readonly compiledStack?: string;
    readonly errorCount?: number;
    readonly fixPrompt: string;
    readonly originalCodeFrameContent?: string;
    readonly originalFileColumn: number;
    readonly originalFileLine: number;
    readonly originalFilePath: string;
    readonly originalSnippet: string;
    readonly originalStack?: string;
    readonly plugin?: string;
}

// Type guards for better type safety
export const isErrorLike = (value: unknown): value is ErrorLike =>
    typeof value === "object" && value !== null && ("message" in value || "name" in value || "stack" in value);

export const isVueErrorInfo = (value: unknown): value is VueErrorInfo =>
    typeof value === "object" && value !== null && "column" in value && "filePath" in value && "line" in value;

// Utility types for function signatures
export type StackFrameValidator = (line: string) => boolean;
