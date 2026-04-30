import type { VisConfig } from "./config/workspace";

declare global {
    namespace Cerebro {
        interface ExtensionOverrides {
            visConfig?: VisConfig;
            visConfigError?: { file?: string; message: string };
            workspaceRoot?: string;
        }
    }
}
