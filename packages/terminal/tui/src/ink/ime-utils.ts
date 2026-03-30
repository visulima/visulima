/**
 * Detect whether a string contains non-ASCII characters that are likely
 * IME (Input Method Editor) composition input — CJK ideographs, Hangul,
 * Thai, Vietnamese diacritics, etc.
 */
const isIMEInput = (data: string): boolean => {
    if (data.length === 0) {
        return false;
    }

    // Check each code point — if any is above the basic Latin + Latin-1
    // supplement range and is NOT a control/escape sequence, treat it as IME.
    for (const character of data) {
        const codePoint = character.codePointAt(0) ?? 0;

        // Skip ASCII (including control characters and escape sequences)
        if (codePoint <= 0x7f) {
            return false;
        }

        // Latin-1 Supplement (0x80-0xFF) can come from Option+key on macOS — not IME
        if (codePoint <= 0xff) {
            return false;
        }

        // Everything above U+00FF is likely IME input
        return true;
    }

    return false;
};

type IMECompositionBufferOptions = {
    onFlush: (text: string) => void;
    timeout: number;
};

/**
 * Buffers rapid multi-byte character input from IME and flushes the
 * accumulated text after a configurable timeout.
 */
class IMECompositionBuffer {
    private buffer = "";

    private timer: ReturnType<typeof setTimeout> | undefined;

    private readonly onFlush: (text: string) => void;

    private readonly timeout: number;

    public constructor({ onFlush, timeout }: IMECompositionBufferOptions) {
        this.onFlush = onFlush;
        this.timeout = timeout;
    }

    public add(text: string): void {
        this.buffer += text;

        if (this.timer !== undefined) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => {
            this.flush();
        }, this.timeout);
    }

    public flush(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        if (this.buffer.length > 0) {
            const text = this.buffer;

            this.buffer = "";
            this.onFlush(text);
        }
    }

    public destroy(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        this.buffer = "";
    }
}

export { IMECompositionBuffer, isIMEInput };
