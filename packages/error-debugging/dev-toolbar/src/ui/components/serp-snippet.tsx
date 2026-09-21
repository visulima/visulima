/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

interface SerpSnippetProps {
    /** Already truncated to the limit for this viewport. */
    description: string;
    favicon?: string;
    /** Narrower frame and a 3-line description clamp. */
    isMobile?: boolean;
    issues: string[];
    label: string;
    siteName: string;
    /** Already truncated to the title limit. */
    title: string;
    url: string;
}

/** One Google result snippet as the page would appear, plus what would spoil it. */
const SerpSnippet = ({ description, favicon, isMobile = false, issues, label, siteName, title, url }: SerpSnippetProps): JSX.Element => (
    <div class="border border-border bg-card p-4 mb-4">
        <p class="text-[0.7rem] font-semibold text-muted-foreground mb-3">{label}</p>

        <div class={clsx("border border-border/50 bg-background p-4 font-sans", isMobile ? "max-w-[380px]" : "max-w-[600px]")}>
            <div class="flex items-center gap-3 mb-2">
                {favicon ? (
                    <img alt="favicon" class="size-7 rounded-full shrink-0 object-contain" src={favicon} />
                ) : (
                    <div class="size-7 rounded-full shrink-0 bg-foreground/10 flex items-center justify-center" />
                )}
                <div class="flex flex-col min-w-0">
                    <span class="text-[0.875rem] text-foreground leading-snug">{siteName || url}</span>
                    <span class="text-[0.75rem] text-muted-foreground leading-snug truncate">{url}</span>
                </div>
            </div>

            <p class="text-[1.25rem] font-normal leading-snug mb-1 m-0" style={{ color: "var(--color-info, #1a0dab)" }}>
                {title || "No title"}
            </p>

            <p class={clsx("text-[0.875rem] text-muted-foreground leading-relaxed m-0", isMobile && "line-clamp-3")}>{description || "No meta description."}</p>
        </div>

        {issues.length > 0 && (
            <div class="mt-3">
                <p class="text-[0.7rem] font-semibold text-destructive mb-1">Issues:</p>
                <ul class="m-0 pl-5 list-disc">
                    {issues.map((issue) => (
                        <li class="text-[0.75rem] text-destructive/80 mt-0.5" key={issue}>
                            {issue}
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
);

export default SerpSnippet;
