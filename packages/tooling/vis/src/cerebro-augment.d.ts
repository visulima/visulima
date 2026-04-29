import type { VisConfig } from "./workspace";

declare global {
    namespace Cerebro {
        interface ExtensionOverrides {
            visConfig?: VisConfig;
            visConfigError?: { file?: string; message: string };
            workspaceRoot?: string;
        }
    }
}
