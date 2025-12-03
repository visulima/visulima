export type { CodeFrameLocation, CodeFrameNodeLocation, CodeFrameOptions, ColorizeMethod } from "./code-frame";
export { CODE_FRAME_POINTER, codeFrame } from "./code-frame";
export { default as indexToLineColumn } from "./code-frame/index-to-line-column";
export type { ErrorHint, ErrorLocation, ErrorProperties, ErrorWithCauseSerializerOptions, RenderErrorOptions, SerializedError } from "./error";
export {
    addKnownErrorConstructor,
    captureRawStackTrace,
    deserializeError,
    getErrorCauses,
    isErrorLike,
    isVisulimaError,
    NonError,
    renderError,
    serializeError,
    VisulimaError,
} from "./error";
export { default as aiPrompt } from "./solution/ai/ai-prompt";
export { default as aiSolutionResponse } from "./solution/ai/ai-solution-response";
export { default as errorHintFinder } from "./solution/error-hint-finder";
export { default as ruleBasedFinder } from "./solution/rule-based-finder";
export type { Solution, SolutionError, SolutionFinder, SolutionFinderFile } from "./solution/types";
export type { Trace, TraceType } from "./stacktrace";
export { formatStackFrameLine, formatStacktrace, parseStacktrace } from "./stacktrace";
