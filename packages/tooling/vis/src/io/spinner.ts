import { InteractiveManager, InteractiveStreamHook } from "@visulima/interactive-manager";
import type { SpinnerOptions } from "@visulima/spinner";
import { Spinner } from "@visulima/spinner";

/**
 * Creates a Spinner wired to a fresh InteractiveManager so it actually
 * renders frames. Without a manager, `@visulima/spinner` is silent on
 * TTY. Each spinner gets its own manager — sufficient for short-lived
 * single-spinner CLI commands.
 */
export const createSpinner = (options: SpinnerOptions = {}): Spinner => {
    const manager = new InteractiveManager(new InteractiveStreamHook(process.stdout), new InteractiveStreamHook(process.stderr));

    return new Spinner(options, manager);
};
