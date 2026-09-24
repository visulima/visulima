/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { JsonViewRegistry } from "../../json-view";
import { baseActions, baseRegistry, JsonView } from "../../json-view";
import type { AppComponentProps } from "../../types/app";
import { Button, LoadingState } from "../../ui";
import EnvTable from "./components/env-table";
import PluginList from "./components/plugin-list";
import buildViteConfigSpec from "./spec";
import type { ViteConfig } from "./types";

const registry: JsonViewRegistry = { ...baseRegistry, EnvTable, PluginList };

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }): JSX.Element => (
    <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <p class="text-sm text-destructive">{error}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
            Retry
        </Button>
    </div>
);

const ViteConfigApp = ({ helpers }: AppComponentProps): JSX.Element => {
    const [config, setConfig] = useState<ViteConfig | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    const load = (): void => {
        setLoading(true);
        setError(undefined);

        (helpers.rpc as unknown as { getViteConfig: () => Promise<ViteConfig> })
            .getViteConfig()
            .then((data) => {
                setConfig(data);
                setLoading(false);

                return undefined;
            })
            .catch((error_: unknown) => {
                setError(error_ instanceof Error ? error_.message : "Failed to load Vite config");
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, []);

    const spec = useMemo(() => (config ? buildViteConfigSpec(config) : undefined), [config]);

    if (loading) {
        return <LoadingState label="Loading Vite config…" />;
    }

    if (error !== undefined || !spec) {
        return <ErrorState error={error ?? "No config available"} onRetry={load} />;
    }

    return <JsonView actions={{ ...baseActions, refresh: load }} registry={registry} spec={spec} />;
};

export default ViteConfigApp;
