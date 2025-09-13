import type { ErrorPayload, ViteDevServer } from "vite";

// Type definitions for the Vite overlay plugin

export interface ExtendedErrorPayload {
    causes: ExtendedErrorCause[];
    isServerError?: boolean;
    message: string;
    name: string;
    stack?: string;
}

export interface ExtendedErrorCause {
    codeFrameContent?: string;
    compiledCodeFrameContent?: string;
    compiledColumn?: number;
    compiledFilePath?: string;
    compiledLine?: number;
    compiledSnippet?: string;
    fileColumn?: number;
    fileLine?: number;
    filePath?: string;
    fixPrompt?: string;
    message: string;
    name: string;
    originalCodeFrameContent?: string;
    originalSnippet?: string;
    snippet?: string;
    stack?: string;
}

export interface DevelopmentLogger {
    error: (message: unknown) => void;
    log: (message: unknown) => void;
}

export interface RecentErrorTracker {
    recentErrors: Map<string, number>;
    shouldSkip: (signature: string) => boolean;
}

export interface RawErrorData {
    column?: number | null;
    file?: string | null;
    line?: number | null;
    message?: string;
    name?: string;
    ownerStack?: string | null;
    stack?: string;
}

export interface ProvidedCause {
    message?: string;
    name?: string;
    stack?: string;
}

// Vue error adapter types
export interface VueErrorInfo {
    column: number;
    filePath: string;
    line: number;
    message?: string;
}

// Utility types for better type safety
export type ViteServer = ViteDevServer;
export type ErrorOrPayload = ErrorPayload["err"] | Error;
