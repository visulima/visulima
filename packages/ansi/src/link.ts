import { BEL, OSC, SEP } from "./constants";

// eslint-disable-next-line no-secrets/no-secrets
/**
 * Create a clickable link.
 *
 * [Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda) Use [`supports-hyperlinks`](https://github.com/jamestalmage/supports-hyperlinks) to detect link support.
 */
const link = (text: string, url: string): string => [OSC, "8", SEP, SEP, url, BEL, text, OSC, "8", SEP, SEP, BEL].join("");

export default link;
