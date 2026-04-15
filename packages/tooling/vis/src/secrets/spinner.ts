const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
    stop: (finalMessage?: string) => void;
    update: (message: string) => void;
}

/**
 * Minimal stderr spinner for TTY sessions. No-op when stderr isn't a TTY
 * (CI, piped output). No dependencies beyond node stdlib.
 */
export const startSpinner = (message: string): Spinner => {
    const isTty = typeof process.stderr.isTTY === "boolean" && process.stderr.isTTY;

    if (!isTty) {
        return { stop: () => {}, update: () => {} };
    }

    let currentMessage = message;
    let frame = 0;
    const render = (): void => {
        process.stderr.write(`\r${FRAMES[frame % FRAMES.length]} ${currentMessage}`);
        frame += 1;
    };

    render();
    const timer = setInterval(render, 80);

    timer.unref?.();

    return {
        stop: (finalMessage?: string) => {
            clearInterval(timer);
            process.stderr.write("\r\u001B[2K");

            if (finalMessage) {
                process.stderr.write(`${finalMessage}\n`);
            }
        },
        update: (next: string) => {
            currentMessage = next;
        },
    };
};
