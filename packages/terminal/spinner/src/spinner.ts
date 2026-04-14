import { getRandomSpinner, getSpinner } from "./spinners";
import type { SpinnerFrame, SpinnerOptions, SpinnerStatus } from "./types";

/**
 * A terminal spinner that displays animated frames with accompanying text
 */
// eslint-disable-next-line import/prefer-default-export
export class Spinner {
    private currentFrame = 0;

    private status: SpinnerStatus = "stopped";

    private spinnerFrame: SpinnerFrame;

    private animationInterval: NodeJS.Timeout | undefined;

    private prefixText: string;

    private text: string;

    private isEnabled: boolean;

    private successSymbol: string;

    private failureSymbol: string;

    private warningSymbol: string;

    private stream: NodeJS.WritableStream;

    public constructor(options?: SpinnerOptions) {
        this.isEnabled = options?.isEnabled !== false;
        this.prefixText = options?.prefixText ?? "";
        this.text = options?.text ?? "";
        this.successSymbol = options?.successSymbol ?? "✓";
        this.failureSymbol = options?.failureSymbol ?? "✖";
        this.warningSymbol = options?.warningSymbol ?? "⚠";
        this.stream = options?.stream ?? process.stdout;

        // Get spinner frame
        const spinnerName = options?.spinner ?? "dots";

        this.spinnerFrame = getSpinner(spinnerName) ?? getRandomSpinner();
    }

    /**
     * Starts the spinner animation, optionally setting new text.
     * @param text Optional text to display with the spinner
     * @returns The Spinner instance for method chaining
     */
    public start(text?: string): this {
        if (!this.isEnabled) {
            return this;
        }

        if (text !== undefined) {
            this.text = text;
        }

        if (this.status === "spinning") {
            return this;
        }

        this.status = "spinning";
        this.currentFrame = 0;
        this.hideCursor();

        this.animationInterval = setInterval(() => {
            this.render();
        }, this.spinnerFrame.interval);

        // Render first frame immediately
        this.render();

        return this;
    }

    /**
     * Stops the spinner animation without clearing the output line.
     * @returns The Spinner instance for method chaining
     */
    public stop(): this {
        if (this.animationInterval !== undefined) {
            clearInterval(this.animationInterval);
            this.animationInterval = undefined;
        }

        this.status = "stopped";
        this.showCursor();

        return this;
    }

    /**
     * Stops the spinner and displays a success message.
     * @param text Optional text to display with the success symbol
     * @returns The Spinner instance for method chaining
     */
    public succeed(text?: string): this {
        this.stop();

        if (text !== undefined) {
            this.text = text;
        }

        this.status = "succeeded";
        this.clearLine();
        this.writeOutput(`${this.successSymbol} ${this.text}`);

        return this;
    }

    /**
     * Stops the spinner and displays a failure message.
     * @param text Optional text to display with the failure symbol
     * @returns The Spinner instance for method chaining
     */
    public fail(text?: string): this {
        this.stop();

        if (text !== undefined) {
            this.text = text;
        }

        this.status = "failed";
        this.clearLine();
        this.writeOutput(`${this.failureSymbol} ${this.text}`);

        return this;
    }

    /**
     * Stops the spinner and displays a warning message.
     * @param text Optional text to display with the warning symbol
     * @returns The Spinner instance for method chaining
     */
    public warn(text?: string): this {
        this.stop();

        if (text !== undefined) {
            this.text = text;
        }

        this.status = "warned";
        this.clearLine();
        this.writeOutput(`${this.warningSymbol} ${this.text}`);

        return this;
    }

    /**
     * Updates the spinner text and rerenders if currently spinning.
     * @param text The new text to display
     * @returns The Spinner instance for method chaining
     */
    public setText(text: string): this {
        this.text = text;

        if (this.status === "spinning") {
            this.render();
        }

        return this;
    }

    /**
     * Updates the prefix text and rerenders if currently spinning.
     * @param text The new prefix text to display
     * @returns The Spinner instance for method chaining
     */
    public setPrefixText(text: string): this {
        this.prefixText = text;

        if (this.status === "spinning") {
            this.render();
        }

        return this;
    }

    /**
     * Gets the current status of the spinner.
     * @returns The current spinner status
     */
    public getStatus(): SpinnerStatus {
        return this.status;
    }

    /**
     * Gets the current spinner text.
     * @returns The current text being displayed
     */
    public getText(): string {
        return this.text;
    }

    /**
     * Renders the current animation frame to the output stream.
     */
    private render(): void {
        if (this.status !== "spinning") {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const frame = this.spinnerFrame.frames[this.currentFrame]!;
        const prefix = this.prefixText ? `${this.prefixText} ` : "";
        const output = `${prefix}${frame} ${this.text}`;

        this.clearLine();
        this.writeOutput(output);

        this.currentFrame = (this.currentFrame + 1) % this.spinnerFrame.frames.length;
    }

    /**
     * Clears the current output line if connected to a TTY.
     */
    private clearLine(): void {
        const streamWithTTY = this.stream as NodeJS.WritableStream & { isTTY?: boolean };

        if (!streamWithTTY.isTTY) {
            return;
        }

        this.stream.write("\r\u001B[K");
    }

    /**
     * Writes output to the stream.
     * @param output The string to write
     */
    private writeOutput(output: string): void {
        this.stream.write(output);
    }

    /**
     * Hides the cursor if connected to a TTY.
     */
    private hideCursor(): void {
        const streamWithTTY = this.stream as NodeJS.WritableStream & { isTTY?: boolean };

        if (!streamWithTTY.isTTY) {
            return;
        }

        this.stream.write("\u001B[?25l");
    }

    /**
     * Shows the cursor if connected to a TTY.
     */
    private showCursor(): void {
        const streamWithTTY = this.stream as NodeJS.WritableStream & { isTTY?: boolean };

        if (!streamWithTTY.isTTY) {
            return;
        }

        this.stream.write("\u001B[?25h");
    }
}
