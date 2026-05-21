import { AnolilabLogo } from "@/components/anolilab-logo";
import type { LiveStatus } from "@/hooks/use-live-events";
import { cn } from "@/lib/utils";

interface FooterProps {
    arch: string | undefined;
    live: LiveStatus;
    node: string | undefined;
    platform: string | undefined;
    workspaceRoot: string | undefined;
}

const liveLabel: Record<LiveStatus, string> = {
    closed: "OFFLINE",
    connecting: "CONNECTING",
    open: "LIVE",
};

const liveColor: Record<LiveStatus, string> = {
    closed: "bg-accent",
    connecting: "bg-warning",
    open: "bg-success",
};

export const Footer = ({ arch, live, node, platform, workspaceRoot }: FooterProps) => {
    const platformLabel = platform && arch ? `${platform}/${arch}` : (platform ?? "—");

    return (
        <footer className="nd-sig mx-12 mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-5 pb-8 text-[10px] uppercase">
            <span className="nd-sig-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                <b>vis</b>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-2">
                    <span className={cn("inline-block h-[7px] w-[7px]", liveColor[live], live === "open" && "nd-blink")} />
                    {liveLabel[live]}
{" "}
SSE
                </span>
                <span aria-hidden>·</span>
                <span>
                    NODE
                    {node ?? "—"}
                </span>
                <span aria-hidden>·</span>
                <span>{platformLabel}</span>
                {workspaceRoot
                    ? (
                    <>
                        <span aria-hidden>·</span>
                        <span className="break-all normal-case tracking-normal text-faint">{workspaceRoot}</span>
                    </>
                    )
                    : null}
            </span>

            <span className="nd-sig-by inline-flex items-center gap-2">
                <span>built by</span>
                <a
                    aria-label="Anolilab"
                    className="nd-sig-by-link inline-flex items-center"
                    href="https://anolilab.com"
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    <AnolilabLogo />
                </a>
            </span>
        </footer>
    );
};
