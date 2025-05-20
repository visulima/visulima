import { BEL, OSC, SEP } from "./constants";

/**
 * Creates a clickable hyperlink in the terminal.
 *
 * This function constructs an ANSI escape sequence that, when printed to a compatible terminal,
 * renders as a clickable link. The link's visible text and its target URL are specified
 * by the `text` and `url` parameters, respectively.
 *
 * For information on terminal support for hyperlinks, see this
 * [Gist by Egmont Kob](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda).
 * To programmatically check for hyperlink support in the current environment,
 * consider using a library like [`supports-hyperlinks`](https://github.com/jamestalmage/supports-hyperlinks).
 *
 * @param text The visible text of the link.
 * @param url The URL the link should point to.
 * @returns A string representing the ANSI escape sequence for the hyperlink.
 * @example
 * \`\`\`typescript
 * import { hyperlink } from "@visulima/ansi/hyperlink"; // Adjust import path as needed
 *
 * const aLink = link("Visulima", "https://www.visulima.com");
 * console.log(`Visit ${aLink} for more information.`);
 * // In a supported terminal, this will output:
 * // Visit Visulima for more information. (where "Visulima" is a clickable link)
 * \`\`\`
 * @see {@link https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda} for supported terminals.
 */
// eslint-disable-next-line no-secrets/no-secrets
export const hyperlink = (text: string, url: string): string => [OSC, "8", SEP, SEP, url, BEL, text, OSC, "8", SEP, SEP, BEL].join("");
