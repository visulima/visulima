/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Badge, Button } from "../../ui";
import cn from "../../utils/cn";

type ViteConfig = Record<string, unknown>;

const CopyButton = ({ text }: { text: string }): ComponentChildren => {
    const [copied, setCopied] = useState(false);

    const copy = (): void => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(setCopied, 1500, false);

                return undefined;
            })
            .catch(() => { /* ignore */ });
    };

    return (
        <Button
            class={cn(
                copied ? "border-primary/40 text-primary bg-primary/8" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                "text-[0.65rem]",
            )}
            onClick={copy}
            size="sm"
            title="Copy to clipboard"
            variant="outline"
        >
            {copied ? "Copied!" : "Copy"}
        </Button>
    );
};

const Section = ({ data, defaultOpen = true, title }: { data: unknown; defaultOpen?: boolean; title: string }): ComponentChildren => {
    const [open, setOpen] = useState(defaultOpen);
    const json = JSON.stringify(data, undefined, 2);

    return (
        <section class="border border-border">
            <button
                class="w-full flex items-center justify-between gap-2 px-4 py-3 bg-foreground/3 hover:bg-foreground/6 transition-colors cursor-pointer border-0 text-left"
                onClick={() => setOpen((o) => !o)}
                type="button"
            >
                <span class="text-[0.75rem] font-semibold text-foreground uppercase tracking-wide">{title}</span>
                <div class="flex items-center gap-2">
                    <CopyButton text={json} />
                    <span class={cn("text-muted-foreground text-[0.7rem] transition-transform duration-200", open && "rotate-90")}>▶</span>
                </div>
            </button>
            {open && (
                <pre class="text-[0.7rem] font-mono text-foreground/80 bg-transparent p-4 overflow-auto whitespace-pre-wrap break-all border-t border-border">
                    {json}
                </pre>
            )}
        </section>
    );
};

const ViteConfigApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    const [config, setConfig] = useState<ViteConfig | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    const load = (): void => {
        setLoading(true);
        setError(undefined);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (helpers.rpc as any)
            .getViteConfig()
            .then((data: ViteConfig) => {
                setConfig(data);
                setLoading(false);

                return undefined;
            })
            .catch((error_: Error) => {
                setError(error_.message ?? "Failed to load Vite config");
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, []);

    if (loading) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div aria-hidden="true" class="flex gap-1.5 items-center">
                    {([0, 160, 320] as const).map((delay) => (
                        <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
                    ))}
                </div>
                <span class="text-[0.75rem] text-muted-foreground">Loading Vite config…</span>
            </div>
        );
    }

    if (error || !config) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <p class="text-[0.8rem] text-destructive">{error ?? "No config available"}</p>
                <Button onClick={load} size="sm" variant="outline">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div class="p-5 space-y-4">
            {/* Header badges */}
            <div class="flex items-center gap-2 flex-wrap">
                {config.mode && (
                    <Badge class="uppercase tracking-wider" variant="default">
                        {config.mode}
                    </Badge>
                )}
                {config.root && (
                    <code class="text-[0.7rem] font-mono text-muted-foreground bg-foreground/5 px-2 py-1 border border-border/50">{config.root}</code>
                )}
                {config.base && config.base !== "/" && (
                    <code class="text-[0.7rem] font-mono text-muted-foreground bg-foreground/5 px-2 py-1 border border-border/50">base: {config.base}</code>
                )}
                <Button class="ml-auto" onClick={load} size="sm" variant="outline">
                    Refresh
                </Button>
            </div>

            {/* Sections */}
            {config.server && <Section data={config.server} defaultOpen={true} title="Server" />}
            {config.build && <Section data={config.build} defaultOpen={false} title="Build" />}
            {config.resolve && <Section data={config.resolve} defaultOpen={false} title="Resolve / Alias" />}
        </div>
    );
};

export default ViteConfigApp;
