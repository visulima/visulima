/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import eyeIcon from "lucide-static/icons/eye.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import eyeOffIcon from "lucide-static/icons/eye-off.svg?data-uri&encoding=css";
import type { ComponentChildren, JSX } from "preact";
import { useState } from "preact/hooks";

import CopyButton from "../../../json-view/components/copy-button";
import Section from "../../../json-view/components/section";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../ui";
import Icon from "../../../ui/components/icon";

/** Built-in Vite env vars, never secret — tagged so a reader can skip them. */
const VITE_BUILTIN_KEYS = new Set(["BASE_URL", "DEV", "MODE", "PROD", "SSR"]);

const VALUE_TRUNCATE_AT = 36;

const COLUMN_LABEL = "text-xxs font-bold uppercase tracking-widest text-muted-foreground";

const SecretValue = ({ forceVisible, tag, value }: { forceVisible: boolean; tag?: ComponentChildren; value: string }): JSX.Element => {
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
                    setLocalRevealed((visible) => !visible);
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

/**
 * Environment variables with masked values.
 *
 * Hand-written for the same reason as the plugin list: per-row reveal plus a
 * reveal-all override is state derived per row, which the base spec vocabulary
 * cannot express.
 */
const EnvTable = ({ rows }: { rows: { key: string; value: string }[] }): JSX.Element => {
    const [revealAll, setRevealAll] = useState(false);

    return (
        <Section title="Environment Variables">
            <div class="grid grid-cols-2 gap-4 px-4 py-1.5 bg-secondary border-b border-border">
                <span class={COLUMN_LABEL}>Key</span>
                <div class="flex items-center justify-between gap-2">
                    <span class={COLUMN_LABEL}>Value</span>
                    <button
                        class="inline-flex items-center gap-1 text-xxs font-mono text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                        onClick={() => {
                            setRevealAll((revealed) => !revealed);
                        }}
                        type="button"
                    >
                        <Icon size={10} src={revealAll ? eyeOffIcon : eyeIcon} />
                        {revealAll ? "hide all" : "reveal all"}
                    </button>
                </div>
            </div>
            {rows.map(({ key, value }) => (
                <div class="grid grid-cols-2 gap-4 px-4 py-1.5 border-t border-border hover:bg-secondary transition-colors duration-100" key={key}>
                    <code class="text-xs font-mono text-primary truncate self-center">{key}</code>
                    <div class="self-center min-w-0">
                        <SecretValue
                            forceVisible={revealAll}
                            tag={
                                <span
                                    class={clsx(
                                        COLUMN_LABEL,
                                        "font-mono px-1 py-0.5 bg-secondary border border-border shrink-0 mr-5 normal-case tracking-wide",
                                    )}
                                >
                                    {VITE_BUILTIN_KEYS.has(key) ? "built-in" : "user"}
                                </span>
                            }
                            value={value}
                        />
                    </div>
                </div>
            ))}
        </Section>
    );
};

export default EnvTable;
