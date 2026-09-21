/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

interface SocialCardProps {
    /** Border tint identifying the platform. */
    accentClass?: string;
    description: string;
    image: string;
    /** Tags this platform needs that the page does not set. */
    missing: string[];
    name: string;
    title: string;
    url: string;
}

/** How one platform would unfurl the page. */
const SocialCard = ({ accentClass, description, image, missing, name, title, url }: SocialCardProps): JSX.Element => (
    <div class={clsx("border bg-card overflow-hidden", accentClass)}>
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 bg-foreground/2">
            <span class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{name}</span>
            {missing.length > 0 && (
                <span class="text-[0.6rem] px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/20 font-medium">Missing: {missing.join(", ")}</span>
            )}
        </div>
        <div class="p-3">
            <div class="w-full aspect-[1200/630] bg-foreground/6 border border-border/50 mb-2.5 overflow-hidden relative">
                {image ? (
                    <img alt="OG image preview" class="w-full h-full object-cover" loading="lazy" src={image} />
                ) : (
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="text-[0.65rem] text-muted-foreground/40 uppercase tracking-wider">No image</span>
                    </div>
                )}
            </div>
            {url && <div class="text-[0.6rem] text-muted-foreground/60 uppercase tracking-wider truncate mb-1">{url}</div>}
            <div class="text-[0.8rem] font-semibold text-foreground line-clamp-1">{title}</div>
            {description && <div class="text-[0.7rem] text-muted-foreground line-clamp-2 mt-0.5">{description}</div>}
        </div>
    </div>
);

export default SocialCard;
