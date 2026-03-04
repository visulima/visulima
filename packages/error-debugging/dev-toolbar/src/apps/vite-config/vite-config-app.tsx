/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui";

// ─── Types ──────────────────────────────────────────────────────────────────

type PluginInfo = {
    enforce?: "post" | "pre";
    name: string;
};

type ViteConfig = {
    base: string;
    build?: Record<string, unknown>;
    cacheDir?: string;
    css?: {
        devSourcemap?: boolean;
        preprocessors?: string[];
    };
    define?: Record<string, unknown>;
    env?: Record<string, string>;
    envDir?: string;
    envPrefix?: string | string[];
    esbuild?: Record<string, unknown>;
    mode: string;
    optimizeDeps?: {
        exclude?: string[];
        include?: string[];
    };
    plugins?: PluginInfo[];
    publicDir?: string;
    resolve?: {
        alias?: unknown;
        conditions?: string[];
        dedupe?: string[];
        extensions?: string[];
        mainFields?: string[];
        preserveSymlinks?: boolean;
    };
    root: string;
    server?: {
        cors?: boolean;
        hmrEnabled?: boolean;
        hmrPort?: number;
        host?: boolean | string;
        https?: boolean;
        middlewareMode?: boolean | string;
        open?: boolean | string;
        origin?: string;
        port?: number;
        proxy?: string[];
        strictPort?: boolean;
    };
    ssr?: {
        external?: string[];
        noExternal?: boolean | string[];
        target?: string;
    };
};

// ─── Primitives ─────────────────────────────────────────────────────────────

/** Section with // prefix title — matches settings-app pattern */
const Section = ({ children, title }: { children: ComponentChildren; title?: string }): ComponentChildren => (
    <section class="space-y-1.5">
        {title && (
            <h3 class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground px-1 flex items-center gap-1.5">
                <span aria-hidden="true" class="text-primary/50">
                    //
                </span>
                {title}
            </h3>
        )}
        <div class="rounded-none border border-border bg-card divide-y divide-border overflow-hidden border-l-2 border-l-primary/20">{children}</div>
    </section>
);

/** Copy-to-clipboard button — compact, outline variant */
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
            .catch(() => {
                /* ignore */
            });
    };

    return (
        <button
            class={clsx(
                "inline-flex items-center px-1.5 py-0.5 text-[0.6rem] font-mono border transition-colors duration-150 cursor-pointer",
                copied
                    ? "border-primary/40 text-primary bg-primary/8"
                    : "border-border text-muted-foreground/60 hover:text-foreground hover:border-foreground/30 bg-transparent",
            )}
            onClick={copy}
            title="Copy to clipboard"
            type="button"
        >
            {copied ? "copied" : "copy"}
        </button>
    );
};

// ─── Value renderers ─────────────────────────────────────────────────────────

/** Boolean indicator — true = success green, false = muted (not alarming for config values) */
const BoolValue = ({ value }: { value: boolean }): ComponentChildren => (
    <span class="inline-flex items-center gap-1.5">
        <span
            aria-hidden="true"
            class={clsx("inline-block size-1.5 rounded-full", value ? "bg-success" : "bg-muted-foreground/30")}
        />
        <span class={clsx("text-[0.7rem] font-mono font-medium", value ? "text-success" : "text-muted-foreground")}>{value ? "true" : "false"}</span>
    </span>
);

/** Compact pill list for arrays — uses KeyBadge pattern from settings-app */
const TagList = ({ items }: { items: string[] }): ComponentChildren => {
    if (items.length === 0) {
        return <span class="text-muted-foreground/40 text-[0.7rem] italic">empty</span>;
    }

    return (
        <div class="flex flex-wrap gap-1">
            {items.map((item) => (
                <span class="inline-flex items-center px-1.5 py-0.5 text-[0.65rem] font-mono font-medium bg-foreground/8 border border-border text-foreground" key={item}>
                    {item}
                </span>
            ))}
        </div>
    );
};

/** Renders any value into the appropriate display element */
const ValueCell = ({ value }: { value: unknown }): ComponentChildren => {
    if (value === undefined || value === null) {
        return <span class="text-muted-foreground/30 text-[0.7rem]">—</span>;
    }

    if (typeof value === "boolean") {
        return <BoolValue value={value} />;
    }

    if (Array.isArray(value)) {
        return <TagList items={value.map(String)} />;
    }

    if (typeof value === "object") {
        const json = JSON.stringify(value, undefined, 2);

        return (
            <div class="flex items-start gap-2">
                <pre class="text-[0.65rem] font-mono text-foreground/80 bg-foreground/4 border border-border/50 px-2 py-1 overflow-auto max-h-24 flex-1 leading-relaxed">
                    {json}
                </pre>
                <CopyButton text={json} />
            </div>
        );
    }

    // Long path-like strings need break-all so they don't overflow the panel
    return <code class="text-[0.7rem] font-mono text-foreground/90 break-all leading-relaxed">{String(value)}</code>;
};

/**
 * Key → Value row — dense data row with label on left, value on right.
 * Returns null if value is undefined/null to avoid empty rows.
 */
const KVRow = ({ label, value }: { label: string; value: unknown }): ComponentChildren => {
    if (value === undefined || value === null) {
        return undefined;
    }

    return (
        <div class="flex items-start gap-4 px-4 py-2.5 hover:bg-foreground/3 transition-colors duration-100">
            <span class="text-[0.7rem] text-muted-foreground font-mono min-w-[9rem] shrink-0 pt-0.5 select-none">{label}</span>
            <div class="text-[0.7rem] flex-1 min-w-0 pt-0.5">
                <ValueCell value={value} />
            </div>
        </div>
    );
};

// ─── Loading / Error states ─────────────────────────────────────────────────

const LoadingState = (): ComponentChildren => (
    <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
        <div aria-hidden="true" class="flex gap-1.5 items-center">
            {([0, 160, 320] as const).map((delay) => (
                <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
            ))}
        </div>
        <span class="text-[0.75rem] text-muted-foreground">Loading Vite config…</span>
    </div>
);

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }): ComponentChildren => (
    <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <p class="text-[0.8rem] text-destructive">{error}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
            Retry
        </Button>
    </div>
);

// ─── Plugin row ──────────────────────────────────────────────────────────────

const ENFORCE_COLORS: Record<string, string> = {
    post: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pre: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const PluginRow = ({ index, plugin }: { index: number; plugin: PluginInfo }): ComponentChildren => (
    <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/3 transition-colors duration-100">
        <span class="text-[0.65rem] text-muted-foreground/40 font-mono tabular-nums w-5 shrink-0 text-right select-none">{index + 1}</span>
        <span class="text-[0.7rem] font-mono text-foreground/90 flex-1 truncate">{plugin.name}</span>
        {plugin.enforce ? (
            <span class={clsx("text-[0.6rem] font-mono font-bold px-1.5 py-0.5 border uppercase tracking-wide", ENFORCE_COLORS[plugin.enforce])}>
                {plugin.enforce}
            </span>
        ) : (
            <span class="text-[0.6rem] font-mono text-muted-foreground/30 px-1.5 py-0.5">normal</span>
        )}
    </div>
);

// ─── Table head row ──────────────────────────────────────────────────────────

/** Shared table header for 2-column + copy-button tables */
const TableHead = ({ col1, col2 }: { col1: string; col2: string }): ComponentChildren => (
    <tr class="bg-foreground/4 border-b border-border">
        <th class="text-left px-4 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground w-[45%]">{col1}</th>
        <th class="text-left px-4 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{col2}</th>
        <th class="w-12" />
    </tr>
);

// ─── Alias table ─────────────────────────────────────────────────────────────

const AliasTable = ({ alias }: { alias: unknown }): ComponentChildren => {
    if (!alias) {
        return undefined;
    }

    let entries: Array<{ find: string; replacement: string }> = [];

    if (Array.isArray(alias)) {
        // Server already normalizes RegExp → string; data arrives as { find: string, replacement: string }[]
        entries = (alias as Array<{ find: string; replacement: string }>).filter((a) => a?.find != null);
    } else if (typeof alias === "object" && alias !== null) {
        entries = Object.entries(alias as Record<string, string>).map(([find, replacement]) => ({ find, replacement }));
    }

    if (entries.length === 0) {
        return undefined;
    }

    return (
        <Section title="Alias">
            <table class="w-full border-collapse">
                <thead>
                    <TableHead col1="Find" col2="Replacement" />
                </thead>
                <tbody>
                    {entries.map(({ find, replacement }) => (
                        <tr class="border-t border-border hover:bg-foreground/3 transition-colors duration-100" key={find}>
                            <td class="px-4 py-2.5 align-top">
                                <code class="text-[0.65rem] font-mono text-primary/80 break-all leading-relaxed">{find}</code>
                            </td>
                            <td class="px-4 py-2.5 align-top">
                                <code class="text-[0.65rem] font-mono text-foreground/70 break-all leading-relaxed">{replacement}</code>
                            </td>
                            <td class="px-4 py-2.5 align-top">
                                <CopyButton text={`${find} → ${replacement}`} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Section>
    );
};

// ─── Key-value table (env vars, defines) ────────────────────────────────────

const KVTable = ({ entries, keyColor, title }: { entries: Array<[string, unknown]>; keyColor?: string; title: string }): ComponentChildren => {
    if (entries.length === 0) {
        return undefined;
    }

    return (
        <Section title={title}>
            <table class="w-full border-collapse">
                <thead>
                    <TableHead col1="Key" col2="Value" />
                </thead>
                <tbody>
                    {entries.map(([key, value]) => (
                        <tr class="border-t border-border hover:bg-foreground/3 transition-colors duration-100" key={key}>
                            <td class="px-4 py-2.5 align-top">
                                <code class={clsx("text-[0.65rem] font-mono break-all leading-relaxed", keyColor ?? "text-foreground/90")}>{key}</code>
                            </td>
                            <td class="px-4 py-2.5 align-top">
                                <code class="text-[0.65rem] font-mono text-foreground/60 break-all leading-relaxed">{String(value)}</code>
                            </td>
                            <td class="px-4 py-2.5 align-top">
                                <CopyButton text={`${key}=${String(value)}`} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Section>
    );
};

// ─── Main App ────────────────────────────────────────────────────────────────

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
        return <LoadingState />;
    }

    if (error || !config) {
        return <ErrorState error={error ?? "No config available"} onRetry={load} />;
    }

    const pluginCount = config.plugins?.length ?? 0;
    const envCount = Object.keys(config.env ?? {}).length;
    const defineCount = Object.keys(config.define ?? {}).length;
    let aliasCount = 0;

    if (Array.isArray(config.resolve?.alias)) {
        aliasCount = config.resolve.alias.length;
    } else if (typeof config.resolve?.alias === "object" && config.resolve.alias !== null) {
        aliasCount = Object.keys(config.resolve.alias).length;
    }

    return (
        <div class="flex flex-col h-full">
            {/* ── Header bar ─────────────────────────────────────────────── */}
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 flex-wrap">
                {config.mode && (
                    <Badge class="uppercase tracking-wider text-[0.6rem]" variant={config.mode === "production" ? "destructive" : "default"}>
                        {config.mode}
                    </Badge>
                )}
                {config.server?.https && (
                    <Badge class="uppercase tracking-wider text-[0.6rem]" variant="success">
                        HTTPS
                    </Badge>
                )}
                {config.ssr && (
                    <Badge class="uppercase tracking-wider text-[0.6rem]" variant="secondary">
                        SSR
                    </Badge>
                )}
                <code class="text-[0.65rem] font-mono text-muted-foreground bg-foreground/5 px-1.5 py-0.5 border border-border/50 truncate max-w-xs">
                    {config.root}
                </code>
                {config.base && config.base !== "/" && (
                    <code class="text-[0.65rem] font-mono text-muted-foreground bg-foreground/5 px-1.5 py-0.5 border border-border/50">
                        base: {config.base}
                    </code>
                )}
                <Button class="ml-auto shrink-0 text-[0.65rem]" onClick={load} size="sm" variant="outline">
                    Refresh
                </Button>
            </div>

            {/* ── Stats strip ────────────────────────────────────────────── */}
            <div class="grid grid-cols-4 divide-x divide-border border-b border-border shrink-0">
                {(
                    [
                        { label: "plugins", value: pluginCount },
                        { label: "env vars", value: envCount },
                        { label: "defines", value: defineCount },
                        { label: "aliases", value: aliasCount },
                    ] as const
                ).map(({ label, value }) => (
                    <div class="flex flex-col items-center py-2 gap-0.5" key={label}>
                        <span class="text-[0.925rem] font-semibold tabular-nums leading-none text-foreground">{value}</span>
                        <span class="text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground/70 font-medium">{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <Tabs class="flex flex-col flex-1 min-h-0" defaultValue="server">
                <div class="shrink-0 border-b border-border bg-muted/40">
                    <TabsList class="w-full rounded-none h-auto p-0 bg-transparent justify-start gap-0 overflow-x-auto">
                        {(
                            [
                                { label: "Server", value: "server" },
                                { label: `Plugins (${pluginCount})`, value: "plugins" },
                                { label: "Build", value: "build" },
                                { label: "Resolve", value: "resolve" },
                                { label: `Env & Define (${envCount + defineCount})`, value: "env" },
                            ] as const
                        ).map(({ label, value }) => (
                            <TabsTrigger
                                class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none px-4 py-2 text-[0.72rem] font-medium shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                key={value}
                                value={value}
                            >
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* ── Server ─────────────────────────────────────────────── */}
                <TabsContent class="flex-1 overflow-auto p-4 space-y-4 mt-0" value="server">
                    <Section>
                        <KVRow label="host" value={config.server?.host ?? false} />
                        <KVRow label="port" value={config.server?.port} />
                        <KVRow label="strictPort" value={config.server?.strictPort} />
                        <KVRow label="https" value={config.server?.https} />
                        <KVRow label="open" value={config.server?.open} />
                        <KVRow label="cors" value={config.server?.cors} />
                        <KVRow label="origin" value={config.server?.origin} />
                        <KVRow label="middlewareMode" value={config.server?.middlewareMode} />
                    </Section>

                    <Section title="HMR">
                        <KVRow label="enabled" value={config.server?.hmrEnabled ?? true} />
                        {config.server?.hmrPort !== undefined && <KVRow label="port" value={config.server.hmrPort} />}
                    </Section>

                    {config.server?.proxy && config.server.proxy.length > 0 && (
                        <Section title="Proxy Routes">
                            {config.server.proxy.map((route) => (
                                <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/3 transition-colors duration-100" key={route}>
                                    <code class="text-[0.7rem] font-mono text-primary/80">{route}</code>
                                </div>
                            ))}
                        </Section>
                    )}
                </TabsContent>

                {/* ── Plugins ────────────────────────────────────────────── */}
                <TabsContent class="flex-1 overflow-auto p-4 mt-0" value="plugins">
                    {pluginCount === 0 ? (
                        <p class="text-[0.8rem] text-muted-foreground text-center py-8">No plugins registered</p>
                    ) : (
                        <Section>
                            <div class="grid grid-cols-[2.5rem_1fr_5rem] px-4 py-1.5 bg-foreground/4 border-b border-border">
                                <span class="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">#</span>
                                <span class="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Name</span>
                                <span class="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground text-right">Enforce</span>
                            </div>
                            {(config.plugins ?? []).map((plugin, index) => (
                                <PluginRow index={index} key={plugin.name} plugin={plugin} />
                            ))}
                        </Section>
                    )}
                </TabsContent>

                {/* ── Build ──────────────────────────────────────────────── */}
                <TabsContent class="flex-1 overflow-auto p-4 space-y-4 mt-0" value="build">
                    <Section>
                        <KVRow label="outDir" value={config.build?.outDir} />
                        <KVRow label="target" value={config.build?.target} />
                        <KVRow label="minify" value={config.build?.minify} />
                        <KVRow label="sourcemap" value={config.build?.sourcemap} />
                        <KVRow label="cssCodeSplit" value={config.build?.cssCodeSplit} />
                        <KVRow label="assetsDir" value={config.build?.assetsDir} />
                        <KVRow label="assetsInlineLimit" value={config.build?.assetsInlineLimit} />
                        <KVRow label="chunkSizeWarningLimit" value={config.build?.chunkSizeWarningLimit} />
                        <KVRow label="emptyOutDir" value={config.build?.emptyOutDir} />
                        <KVRow label="reportCompressedSize" value={config.build?.reportCompressedSize} />
                    </Section>

                    {config.esbuild && (
                        <Section title="esbuild Transform">
                            <KVRow label="jsx" value={config.esbuild.jsx as string | undefined} />
                            <KVRow label="jsxFactory" value={config.esbuild.jsxFactory as string | undefined} />
                            <KVRow label="jsxFragment" value={config.esbuild.jsxFragment as string | undefined} />
                            <KVRow label="jsxImportSource" value={config.esbuild.jsxImportSource as string | undefined} />
                            <KVRow label="target" value={config.esbuild.target as string | string[] | undefined} />
                        </Section>
                    )}

                    <Section title="CSS">
                        <KVRow label="devSourcemap" value={config.css?.devSourcemap} />
                        <KVRow label="preprocessors" value={config.css?.preprocessors} />
                    </Section>

                    {(config.optimizeDeps?.include?.length ?? 0) > 0 || (config.optimizeDeps?.exclude?.length ?? 0) > 0 ? (
                        <Section title="Optimize Deps">
                            <KVRow label="include" value={config.optimizeDeps?.include} />
                            <KVRow label="exclude" value={config.optimizeDeps?.exclude} />
                        </Section>
                    ) : undefined}

                    {config.ssr && (
                        <Section title="SSR">
                            <KVRow label="target" value={config.ssr.target} />
                            <KVRow label="external" value={config.ssr.external} />
                            <KVRow label="noExternal" value={config.ssr.noExternal} />
                        </Section>
                    )}
                </TabsContent>

                {/* ── Resolve ────────────────────────────────────────────── */}
                <TabsContent class="flex-1 overflow-auto p-4 space-y-4 mt-0" value="resolve">
                    <Section>
                        <KVRow label="extensions" value={config.resolve?.extensions} />
                        <KVRow label="conditions" value={config.resolve?.conditions} />
                        <KVRow label="mainFields" value={config.resolve?.mainFields} />
                        <KVRow label="dedupe" value={config.resolve?.dedupe} />
                        <KVRow label="preserveSymlinks" value={config.resolve?.preserveSymlinks} />
                    </Section>

                    <AliasTable alias={config.resolve?.alias} />

                    <Section title="Paths">
                        <KVRow label="root" value={config.root} />
                        <KVRow label="publicDir" value={config.publicDir} />
                        <KVRow label="cacheDir" value={config.cacheDir} />
                        <KVRow label="envDir" value={config.envDir} />
                        <KVRow label="envPrefix" value={config.envPrefix} />
                    </Section>
                </TabsContent>

                {/* ── Env & Define ───────────────────────────────────────── */}
                <TabsContent class="flex-1 overflow-auto p-4 space-y-4 mt-0" value="env">
                    {envCount > 0 ? (
                        <KVTable
                            entries={Object.entries(config.env ?? {})}
                            keyColor="text-primary/80"
                            title="Environment Variables"
                        />
                    ) : (
                        <div class="rounded-none border border-border bg-card border-l-2 border-l-primary/20 px-4 py-3">
                            <p class="text-[0.75rem] text-muted-foreground">No environment variables exposed to the client.</p>
                        </div>
                    )}

                    {defineCount > 0 && (
                        <KVTable
                            entries={Object.entries(config.define ?? {})}
                            keyColor="text-amber-400/90"
                            title="Define Constants"
                        />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ViteConfigApp;
