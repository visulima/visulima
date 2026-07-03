import CerebroError from "./cerebro-error";

/**
 * Error thrown when plugin operations fail.
 */
class PluginError extends CerebroError {
    public readonly pluginName: string;

    public constructor(pluginName: string, message: string, originalError?: Error) {
        super(`Plugin "${pluginName}" error: ${message}`, "PLUGIN_ERROR", { originalError, pluginName });
        this.name = "PluginError";
        this.pluginName = pluginName;

        if (originalError) {
            this.cause = originalError;
        }
    }
}

export default PluginError;
