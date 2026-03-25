import type { VisConfig } from "./workspace";

declare global {
    namespace Cerebro {
        interface ExtensionOverrides {
            visConfig?: VisConfig;
            workspaceRoot?: string;
        }
    }
}
