/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { DevToolbarApp } from "../../types/app";
import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";

const MoreApp = (_props: AppComponentProps): ComponentChildren => {
    const [apps, setApps] = useState<DevToolbarApp[]>([]);

    useEffect(() => {
        const api = (globalThis as any).__VISULIMA_DEVTOOLS__;

        if (!api) {
            return;
        }

        const allApps: DevToolbarApp[] = api.getApps() ?? [];
        // Filter to only non-core apps (overflow apps registered by users)
        const customApps = allApps.filter(
            (a: DevToolbarApp) =>
                !["dev-toolbar:a11y", "dev-toolbar:settings", "dev-toolbar:timeline", "dev-toolbar:more",
                  "dev-toolbar:vite-config", "dev-toolbar:module-graph", "dev-toolbar:seo",
                  "dev-toolbar:performance"].includes(a.id),
        );

        setApps(customApps);
    }, []);

    const openApp = (id: string): void => {
        const api = (globalThis as any).__VISULIMA_DEVTOOLS__;
        api?.openApp(id).catch(console.error);
    };

    if (apps.length === 0) {
        return (
            <div class="p-8 flex flex-col items-center justify-center min-h-48 gap-5 text-center select-none">
                <div class="size-14 bg-primary/5 border border-primary/20 flex items-center justify-center">
                    <svg aria-hidden="true" class="size-6 text-primary/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
                <div class="space-y-1.5">
                    <p class="text-[0.8125rem] font-medium text-foreground/70">No additional apps registered</p>
                    <p class="text-[0.725rem] text-muted-foreground">Register a custom app to see it here</p>
                    <pre class="mt-3 text-[0.65rem] font-mono text-primary/70 bg-primary/5 border border-primary/15 px-3 py-2 text-left">
{`window.__VISULIMA_DEVTOOLS__
  .registerApp({ id, name, icon })`}</pre>
                </div>
            </div>
        );
    }

    return (
        <div class="p-5">
            <h2 class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <span aria-hidden="true" class="text-primary/50">//</span>
                Additional Apps
            </h2>
            <div class="grid grid-cols-2 gap-2">
                {apps.map((app) => (
                    <button
                        key={app.id}
                        class={cn(
                            "flex items-center gap-3 p-3",
                            "border border-border bg-card hover:bg-foreground/4",
                            "text-left cursor-pointer transition-colors duration-150",
                        )}
                        onClick={() => openApp(app.id)}
                        title={app.name}
                        type="button"
                    >
                        <span class="size-5 shrink-0 flex items-center justify-center text-[0.65rem] font-bold uppercase bg-foreground/8 text-foreground/70">
                            {app.name.slice(0, 2)}
                        </span>
                        <span class="text-[0.8125rem] font-medium text-foreground truncate">{app.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MoreApp;
