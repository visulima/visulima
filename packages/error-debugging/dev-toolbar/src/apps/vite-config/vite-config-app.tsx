/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import eyeIcon from "lucide-static/icons/eye.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import eyeOffIcon from "lucide-static/icons/eye-off.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import searchIcon from "lucide-static/icons/search.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Badge, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, TooltipContent, TooltipTrigger } from "../../ui";
import Icon from "../../ui/components/icon";

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

/** Section with // prefix title — matches settings-app pattern. */
const Section = ({ children, title }: { children: ComponentChildren; title?: string }): ComponentChildren => (
    <section class="space-y-1.5">
        {title && (
            <h3 class="text-xxs font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
                <span aria-hidden="true" class="text-primary opacity-50">
                    //
                </span>
                {title}
            </h3>
        )}
        <div class="rounded-none border border-border bg-card divide-y divide-border overflow-hidden border-l-2 border-l-primary/20">{children}</div>
    </section>
);

/** Copy-to-clipboard button — compact, outline variant. */
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
                "inline-flex items-center px-1.5 py-0.5 text-xxs font-mono border transition-colors duration-150 cursor-pointer",
                copied
                    ? "border-primary text-primary bg-card"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground bg-transparent",
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

/** Boolean indicator — true = success green, false = muted (not alarming for config values). */
const BoolValue = ({ value }: { value: boolean }): ComponentChildren => (
    <span class="inline-flex items-center gap-1.5">
        <span aria-hidden="true" class={clsx("inline-block size-1.5 rounded-full", value ? "bg-success" : "bg-border")} />
        <span class={clsx("text-xs font-mono font-medium", value ? "text-success" : "text-muted-foreground")}>{value ? "true" : "false"}</span>
    </span>
);

/** Compact pill list for arrays — uses KeyBadge pattern from settings-app. */
const TagList = ({ items }: { items: string[] }): ComponentChildren => {
    if (items.length === 0) {
        return <span class="text-muted-foreground text-xs italic opacity-50">empty</span>;
    }

    return (
        <div class="flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    class="inline-flex items-center px-1.5 py-0.5 text-xxs font-mono font-medium bg-secondary border border-border text-secondary-foreground"
                    key={item}
                >
                    {item}
                </span>
            ))}
        </div>
    );
};

/**
 * Shorten a path to `…/last/two/segments` for scannability.
 * Full path shown on hover via title attribute.
 */
const ShortPath = ({ path }: { path: string }): ComponentChildren => {
    const segments = path.replaceAll("\\", "/").split("/").filter(Boolean);
    const short = segments.length > 3 ? `…/${segments.slice(-3).join("/")}` : path;

    return (
        <code class="text-xs font-mono text-foreground break-all leading-relaxed" title={path}>
            {short}
        </code>
    );
};

const LOOKS_LIKE_PATH = /^\/|^[A-Z]:\\/i;

/** Renders any value into the appropriate display element. */
const ValueCell = ({ value }: { value: unknown }): ComponentChildren => {
    if (value === undefined || value === null) {
        return <span class="text-muted-foreground text-xs opacity-40">—</span>;
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
                <pre class="text-xs font-mono text-foreground bg-secondary border border-border px-2 py-1 overflow-auto max-h-24 flex-1 leading-relaxed">
                    {json}
                </pre>
                <CopyButton text={json} />
            </div>
        );
    }

    const stringValue = String(value);

    if (LOOKS_LIKE_PATH.test(stringValue) && stringValue.length > 40) {
        return <ShortPath path={stringValue} />;
    }

    return <code class="text-xs font-mono text-foreground break-all leading-relaxed">{stringValue}</code>;
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
        <div class="grid grid-cols-2 gap-4 px-4 py-1.5 hover:bg-secondary transition-colors duration-100">
            <span class="text-xs text-muted-foreground font-mono select-none self-center">{label}</span>
            <div class="text-xs min-w-0 self-center">
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
                <span class="size-1.5 bg-primary rounded-full animate-pulse opacity-50" key={delay} style={{ animationDelay: `${delay}ms` }} />
            ))}
        </div>
        <span class="text-xs text-muted-foreground">Loading Vite config…</span>
    </div>
);

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }): ComponentChildren => (
    <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <p class="text-sm text-destructive">{error}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
            Retry
        </Button>
    </div>
);

// ─── Plugin list ──────────────────────────────────────────────────────────────

const ENFORCE_COLORS: Record<string, string> = {
    post: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pre: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const PluginRow = ({ index, plugin }: { index: number; plugin: PluginInfo }): ComponentChildren => (
    <div class="flex items-center gap-3 px-4 py-1.5 hover:bg-secondary transition-colors duration-100">
        <span class="text-xxs text-muted-foreground font-mono tabular-nums w-5 shrink-0 text-right select-none opacity-40">{index + 1}</span>
        <span class="text-xs font-mono text-foreground flex-1 truncate">{plugin.name}</span>
        {plugin.enforce ? (
            <span class={clsx("text-xxs font-mono font-bold px-1.5 py-0.5 border uppercase tracking-wide", ENFORCE_COLORS[plugin.enforce])}>
                {plugin.enforce}
            </span>
        ) : (
            <span class="text-xxs font-mono text-muted-foreground px-1.5 py-0.5 bg-secondary border border-border">normal</span>
        )}
    </div>
);

const PluginList = ({ plugins }: { plugins: PluginInfo[] }): ComponentChildren => {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const filtered = query ? plugins.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())) : plugins;

    return (
        <Section>
            {/* Search header */}
            <div class="flex items-center gap-2 px-4 py-1.5 bg-secondary border-b border-border">
                <span class="text-xxs font-bold uppercase tracking-widest text-muted-foreground w-6 shrink-0">#</span>
                <div class="flex-1 flex items-center gap-2">
                    <Icon class="text-muted-foreground shrink-0" size={11} src={searchIcon} />
                    <Input
                        class="h-5 text-xs bg-transparent border-0 border-b border-border rounded-none px-0 py-0 focus-visible:ring-0 focus-visible:border-foreground placeholder:text-muted-foreground"
                        onInput={(event) => {
                            setQuery((event.target as HTMLInputElement).value);
                        }}
                        placeholder={`filter ${plugins.length} plugins…`}
                        ref={inputRef}
                        type="search"
                        value={query}
                    />
                </div>
                <span class="text-xxs font-bold uppercase tracking-widest text-muted-foreground w-14 text-right">Enforce</span>
            </div>

            {filtered.length === 0 ? (
                <div class="px-4 py-6 text-center text-xs text-muted-foreground">No plugins match "{query}"</div>
            ) : (
                filtered.map((plugin) => <PluginRow index={plugins.indexOf(plugin)} key={plugin.name} plugin={plugin} />)
            )}

            {query && filtered.length > 0 && (
                <div class="px-4 py-1.5 bg-secondary border-t border-border text-right">
                    <span class="text-xxs text-muted-foreground">
                        {filtered.length} of {plugins.length}
                    </span>
                </div>
            )}
        </Section>
    );
};

const COL_LABEL = "text-xxs font-bold uppercase tracking-widest text-muted-foreground";

/** Two-column grid header. */
const GridHead = ({ col1, col2, extra }: { col1: string; col2: string; extra?: ComponentChildren }): ComponentChildren => (
    <div class="grid grid-cols-2 gap-4 px-4 py-1.5 bg-secondary border-b border-border">
        <span class={COL_LABEL}>{col1}</span>
        <div class="flex items-center justify-between gap-2">
            <span class={COL_LABEL}>{col2}</span>
            {extra}
        </div>
    </div>
);

// ─── Alias table ─────────────────────────────────────────────────────────────

const AliasTable = ({ alias }: { alias: unknown }): ComponentChildren => {
    if (!alias) {
        return undefined;
    }

    let entries: { find: string; replacement: string }[] = [];

    if (Array.isArray(alias)) {
        entries = (alias as { find: string; replacement: string }[]).filter((a) => a?.find !== undefined);
    } else if (typeof alias === "object" && alias !== null) {
        entries = Object.entries(alias as Record<string, string>).map(([find, replacement]) => {
            return { find, replacement };
        });
    }

    if (entries.length === 0) {
        return undefined;
    }

    return (
        <Section title="Alias">
            <GridHead col1="Find" col2="Replacement" />
            {entries.map(({ find, replacement }) => (
                <div
                    class="grid grid-cols-2 gap-4 px-4 py-1.5 border-t border-border hover:bg-secondary transition-colors duration-100"
                    key={find ?? replacement}
                >
                    <code class="text-xs font-mono text-primary break-all leading-relaxed self-center">{find}</code>
                    <div class="self-center">
                        {LOOKS_LIKE_PATH.test(replacement) && replacement.length > 40 ? (
                            <ShortPath path={replacement} />
                        ) : (
                            <code class="text-xs font-mono text-foreground break-all leading-relaxed">{replacement}</code>
                        )}
                    </div>
                </div>
            ))}
        </Section>
    );
};

// ─── Env var table with masked values ────────────────────────────────────────

/** Built-in Vite env vars that are not sensitive — show by default */
const VITE_BUILTIN_KEYS = new Set(["BASE_URL", "DEV", "MODE", "PROD", "SSR"]);

const VALUE_TRUNCATE_AT = 36;

const SecretValue = ({ forceVisible, tag, value }: { forceVisible: boolean; tag?: ComponentChildren; value: string }): ComponentChildren => {
    const [localRevealed, setLocalRevealed] = useState(false);
    const isVisible = forceVisible || localRevealed;
    const needsTruncation = isVisible && value.length > VALUE_TRUNCATE_AT;

    const valueNode = isVisible ? (
        <code class="text-xs font-mono text-foreground truncate block">{value}</code>
    ) : (
        <span class="text-xs font-mono text-muted-foreground tracking-widest select-none">••••••••</span>
    );

    return (
        <div class="flex items-center gap-2 w-full min-w-0">
            <span class="flex-1 min-w-0 overflow-hidden">
                {needsTruncation ? (
                    <Tooltip>
                        <TooltipTrigger class="w-full block cursor-default">{valueNode}</TooltipTrigger>
                        <TooltipContent side="top">
                            <code class="text-xs font-mono break-all max-w-xs block">{value}</code>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    valueNode
                )}
            </span>
            {tag}
            <button
                aria-label={isVisible ? "Hide value" : "Reveal value"}
                class="shrink-0 text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer p-0.5"
                onClick={() => {
                    setLocalRevealed((v) => !v);
                }}
                title={isVisible ? "Hide value" : "Reveal value"}
                type="button"
            >
                <Icon size={11} src={isVisible ? eyeOffIcon : eyeIcon} />
            </button>
            <CopyButton text={value} />
        </div>
    );
};

const EnvVariableTable = ({ entries }: { entries: [string, string][] }): ComponentChildren => {
    const [revealAll, setRevealAll] = useState(false);

    return (
        <Section title="Environment Variables">
            <GridHead
                col1="Key"
                col2="Value"
                extra={
                    <button
                        class="inline-flex items-center gap-1 text-xxs font-mono text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                        onClick={() => {
                            setRevealAll((v) => !v);
                        }}
                        type="button"
                    >
                        <Icon size={10} src={revealAll ? eyeOffIcon : eyeIcon} />
                        {revealAll ? "hide all" : "reveal all"}
                    </button>
                }
            />
            {entries.map(([key, value]) => {
                const isBuiltin = VITE_BUILTIN_KEYS.has(key);

                return (
                    <div class="grid grid-cols-2 gap-4 px-4 py-1.5 border-t border-border hover:bg-secondary transition-colors duration-100" key={key}>
                        <code class="text-xs font-mono text-primary truncate self-center">{key}</code>
                        <div class="self-center min-w-0">
                            <SecretValue
                                forceVisible={revealAll}
                                tag={
                                    <span class="text-xxs font-mono text-muted-foreground px-1 py-0.5 bg-secondary border border-border uppercase tracking-wide shrink-0 mr-5">
                                        {isBuiltin ? "built-in" : "user"}
                                    </span>
                                }
                                value={value}
                            />
                        </div>
                    </div>
                );
            })}
        </Section>
    );
};

// ─── Define constants table ───────────────────────────────────────────────────

const DefineTable = ({ entries }: { entries: [string, unknown][] }): ComponentChildren => {
    if (entries.length === 0) {
        return undefined;
    }

    return (
        <Section title="Define Constants">
            <GridHead col1="Identifier" col2="Replacement" />
            {entries.map(([key, value]) => (
                <div class="grid grid-cols-2 gap-4 px-4 py-1.5 border-t border-border hover:bg-secondary transition-colors duration-100" key={key}>
                    <code class="text-xs font-mono text-amber-400 break-all leading-relaxed self-center">{key}</code>
                    <div class="flex items-center gap-2 self-center min-w-0">
                        <code class="text-xs font-mono text-foreground break-all leading-relaxed flex-1">{JSON.stringify(value)}</code>
                        <CopyButton text={`${key}=${JSON.stringify(value)}`} />
                    </div>
                </div>
            ))}
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
                    <Badge class="uppercase tracking-wider text-xxs" variant={config.mode === "production" ? "destructive" : "default"}>
                        {config.mode}
                    </Badge>
                )}
                {config.server?.https && (
                    <Badge class="uppercase tracking-wider text-xxs" variant="success">
                        HTTPS
                    </Badge>
                )}
                {config.ssr && (
                    <Badge class="uppercase tracking-wider text-xxs" variant="secondary">
                        SSR
                    </Badge>
                )}
                <code class="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 border border-border truncate max-w-xs" title={config.root}>
                    …/{config.root.replaceAll("\\", "/").split("/").slice(-2).join("/")}
                </code>
                {config.base && config.base !== "/" && (
                    <code class="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 border border-border">base: {config.base}</code>
                )}
                <Button class="ml-auto shrink-0 text-xs" onClick={load} size="sm" variant="outline">
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
                        <span class="text-sm font-semibold tabular-nums leading-none text-foreground">{value}</span>
                        <span class="text-xxs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <Tabs class="flex flex-col flex-1 min-h-0" defaultValue="server">
                <div class="shrink-0 border-b border-border bg-muted">
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
                                class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none px-4 py-2 text-xs font-medium shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                                <div class="flex items-center gap-3 px-4 py-1.5 hover:bg-secondary transition-colors duration-100" key={route}>
                                    <code class="text-xs font-mono text-primary">{route}</code>
                                </div>
                            ))}
                        </Section>
                    )}
                </TabsContent>

                {/* ── Plugins ────────────────────────────────────────────── */}
                <TabsContent class="flex-1 overflow-auto p-4 mt-0" value="plugins">
                    {pluginCount === 0 ? (
                        <p class="text-sm text-muted-foreground text-center py-8">No plugins registered</p>
                    ) : (
                        <PluginList plugins={config.plugins ?? []} />
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
                            <KVRow label="jsx" value={config.esbuild.jsx} />
                            <KVRow label="jsxFactory" value={config.esbuild.jsxFactory} />
                            <KVRow label="jsxFragment" value={config.esbuild.jsxFragment} />
                            <KVRow label="jsxImportSource" value={config.esbuild.jsxImportSource} />
                            <KVRow label="target" value={config.esbuild.target} />
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
                        <EnvVariableTable entries={Object.entries(config.env ?? {})} />
                    ) : (
                        <div class="rounded-none border border-border bg-card border-l-2 border-l-primary/20 px-4 py-3">
                            <p class="text-xs text-muted-foreground">No environment variables exposed to the client.</p>
                        </div>
                    )}

                    <DefineTable entries={Object.entries(config.define ?? {})} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ViteConfigApp;
