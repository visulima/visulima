// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?data-uri&encoding=css";

import { sanitizeHtml } from "../util/sanitize";

const tooltip = ({ message }: { message?: string } = {}): string => {
    if (!message)
        return "";

    // Use a simple counter on globalThis to avoid randomness and external deps
    interface GlobalWithCounter {
        flareTooltipCounter?: number;
    }

    const g = globalThis as unknown as GlobalWithCounter;

    g.flareTooltipCounter = (g.flareTooltipCounter ?? 0) + 1;
    const uid = `${Date.now().toString(36)}-${g.flareTooltipCounter}`;

    const safe = sanitizeHtml(message);

    return `<div class="hs-tooltip inline-block">
  <button type="button" class="hs-tooltip-toggle [--placement:*] inline-flex justify-center items-center gap-2 text-[var(--flare-text)]" aria-describedby="tooltip-${uid}">
    <span class="dui" style="-webkit-mask-image: url('${infoIcon}'); mask-image: url('${infoIcon}')"></span>
  </button>
  <div id="tooltip-${uid}" role="tooltip" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-charcoal-black)] text-[var(--flare-white-smoke)]">
    ${safe}
  </div>
</div>`;
};

export default tooltip;
