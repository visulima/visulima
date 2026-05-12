/**
 * OpenAI adapter — exposes the shared tool definitions for two surfaces:
 * `createResponsesFileTools` for `openai.responses.create({ tools })`
 * (Responses API; requires the `openai` peer dependency >=5) and
 * `createAgentsFileTools` for `@openai/agents` (Agents SDK; requires
 * `@openai/agents` peer dependency).
 */

export type { ApprovalConfig } from "../internal/approval";
export type { FileReadToolName, FileToolName, FileWriteToolName } from "../internal/schemas";
export {
    agentsCopyFile,
    agentsDeleteFile,
    agentsDownloadFile,
    type AgentsFileTools,
    type AgentsFileToolsOptions,
    agentsGetFileMetadata,
    agentsGetFileUrl,
    agentsListFiles,
    agentsSignUploadUrl,
    agentsUploadFile,
    createAgentsFileTools,
    type ReadOnlyAgentsFileTools,
} from "./agents";
export {
    createResponsesFileTools,
    type FunctionCallItem,
    type FunctionCallOutputItem,
    type ResponsesFileTools,
    type ResponsesFileToolsOptions,
    type ResponsesFunctionTool,
} from "./responses";
export type { AgentsToolOverrides, ResponsesToolOverrides } from "./types";
