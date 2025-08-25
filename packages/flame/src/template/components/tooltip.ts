// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?raw";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    // Remove HTML comments and clean up the SVG content
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

    // Encode for use in CSS url()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

export const tooltip = ({ message }: { message?: string } = {}): string => {
    if (!message) return "";

    // Use a simple counter on globalThis to avoid randomness and external deps
    interface GlobalWithCounter {
        flameTooltipCounter?: number;
    }

    const g = globalThis as unknown as GlobalWithCounter;
    g.flameTooltipCounter = (g.flameTooltipCounter ?? 0) + 1;
    const uid = `${Date.now().toString(36)}-${g.flameTooltipCounter}`;

    return `<div class="hs-tooltip inline-block">
  <button type="button" class="hs-tooltip-toggle [--placement:*] inline-flex justify-center items-center gap-2 text-[var(--flame-charcoal-black)]" aria-describedby="tooltip-${uid}">
    <span class="dui" style="-webkit-mask-image: url('${svgToDataUrl(infoIcon)}'); mask-image: url('${svgToDataUrl(infoIcon)}')"></span>
  </button>
  <div id="tooltip-${uid}" role="tooltip" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-charcoal-black)] text-[var(--flame-white-smoke)]">
    ${message}
  </div>
</div>`;
};
