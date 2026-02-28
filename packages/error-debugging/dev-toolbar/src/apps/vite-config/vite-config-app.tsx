/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";

type ViteConfig = Record<string, any>;

const CopyButton = ({ text }: { text: string }): ComponentChildren => {
    const [copied, setCopied] = useState(false);

    const copy = (): void => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
    };

    return (
        <button
            class={cn(
                "px-2 py-0.5 text-[0.65rem] font-medium border cursor-pointer transition-colors duration-150",
                copied
                    ? "border-primary/40 text-primary bg-primary/8"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent",
            )}
            onClick={copy}
            title="Copy to clipboard"
            type="button"
        >
            {copied ? "Copied!" : "Copy"}
        </button>
    );
};

const Section = ({
    title,
    data,
    defaultOpen = true,
}: {
    title: string;
    data: unknown;
    defaultOpen?: boolean;
}): ComponentChildren => {
    const [open, setOpen] = useState(defaultOpen);
    const json = JSON.stringify(data, null, 2);

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
    const [config, setConfig] = useState<ViteConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = (): void => {
        setLoading(true);
        setError(null);

        (helpers.rpc as any).getViteConfig().then((data: ViteConfig) => {
            setConfig(data);
            setLoading(false);
        }).catch((err: Error) => {
            setError(err.message ?? "Failed to load Vite config");
            setLoading(false);
        });
    };

    useEffect(() => {
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div class="flex gap-1.5 items-center" aria-hidden="true">
                    {([0, 160, 320] as const).map((delay) => (
                        <span
                            key={delay}
                            class="size-1.5 bg-primary/50 rounded-full animate-pulse"
                            style={{ animationDelay: `${delay}ms` }}
                        />
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
                <button
                    class="px-3 py-1.5 text-[0.75rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent"
                    onClick={load}
                    type="button"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div class="p-5 space-y-4">
            {/* Header badges */}
            <div class="flex items-center gap-2 flex-wrap">
                {config.mode && (
                    <span class="inline-flex items-center px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {config.mode}
                    </span>
                )}
                {config.root && (
                    <code class="text-[0.7rem] font-mono text-muted-foreground bg-foreground/5 px-2 py-1 border border-border/50">
                        {config.root}
                    </code>
                )}
                {config.base && config.base !== "/" && (
                    <code class="text-[0.7rem] font-mono text-muted-foreground bg-foreground/5 px-2 py-1 border border-border/50">
                        base: {config.base}
                    </code>
                )}
                <button
                    class="ml-auto px-2.5 py-1 text-[0.725rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent transition-colors"
                    onClick={load}
                    type="button"
                >
                    Refresh
                </button>
            </div>

            {/* Sections */}
            {config.server && <Section data={config.server} defaultOpen={true} title="Server" />}
            {config.build && <Section data={config.build} defaultOpen={false} title="Build" />}
            {config.resolve && <Section data={config.resolve} defaultOpen={false} title="Resolve / Alias" />}
        </div>
    );
};

export default ViteConfigApp;
