// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?data-uri&encoding=css";

import { sanitizeHtml } from "../util/sanitize";

const tooltip = ({ message }: { message?: string } = {}): string => {
    if (!message)
        return "";

    const safe = sanitizeHtml(message);

    return `<span class="inline-flex justify-center items-center text-[var(--ono-text)] cursor-help" title="${safe}">
  <span class="dui" style="-webkit-mask-image: url('${infoIcon}'); mask-image: url('${infoIcon}')"></span>
</span>`;
};

export default tooltip;
