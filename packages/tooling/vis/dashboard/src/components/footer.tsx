import { AnolilabLogo } from "@/components/anolilab-logo";
import type { LiveStatus } from "@/hooks/use-live-events";
import { cn } from "@/lib/utils";

interface FooterProps {
    workspaceRoot: string | undefined;
    node: string | undefined;
    platform: string | undefined;
    arch: string | undefined;
    live: LiveStatus;
}

const liveLabel: Record<LiveStatus, string> = {
    open: "LIVE",
    connecting: "CONNECTING",
    closed: "OFFLINE",
};

const liveColor: Record<LiveStatus, string> = {
    open: "bg-success",
    connecting: "bg-warning",
    closed: "bg-accent",
};

export const Footer = ({ workspaceRoot, node, platform, arch, live }: FooterProps) => {
    const platformLabel = platform && arch ? `${platform}/${arch}` : platform ?? "—";

    return (
        <footer className="nd-sig mx-12 mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-5 pb-8 text-[10px] uppercase">
            <span className="nd-sig-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                <b>vis</b>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-2">
                    <span
                        className={cn(
                            "inline-block h-[7px] w-[7px]",
                            liveColor[live],
                            live === "open" && "nd-blink",
                        )}
                    />
                    {liveLabel[live]} SSE
                </span>
                <span aria-hidden>·</span>
                <span>NODE {node ?? "—"}</span>
                <span aria-hidden>·</span>
                <span>{platformLabel}</span>
                {workspaceRoot ? (
                    <>
                        <span aria-hidden>·</span>
                        <span className="break-all normal-case tracking-normal text-faint">{workspaceRoot}</span>
                    </>
                ) : null}
            </span>

            <span className="nd-sig-by inline-flex items-center gap-2">
                <span>built by</span>
                <a
                    className="nd-sig-by-link inline-flex items-center"
                    href="https://anolilab.com"
                    rel="noreferrer noopener"
                    target="_blank"
                    aria-label="Anolilab"
                >
                    <AnolilabLogo />
                </a>
            </span>
        </footer>
    );
};
