/**
 * Apply the `expose` flag (which controls whether stack traces leak into the
 * response body) without permanently mutating the caller's error object. The
 * original `expose` state is captured and restored once the handler resolves,
 * so the flag cannot leak into later logging or a second handler invocation
 * configured with different `showTrace` settings.
 * @param error error whose `expose` flag is toggled for the duration of `run`
 * @param showTrace whether stack traces may be exposed in the response body
 * @param run handler invocation to run with the resolved `expose` flag
 */
const withExpose = async <T>(error: Error, showTrace: boolean, run: () => Promise<T> | T): Promise<T> => {
    const hadOwnExpose = Object.hasOwn(error, "expose");
    const previousExpose = (error as Error & { expose?: boolean }).expose;

    if (!showTrace) {
        // eslint-disable-next-line no-param-reassign -- enriching the passed-in error
        (error as Error & { expose: boolean }).expose = false;
    } else if (!("expose" in error)) {
        // eslint-disable-next-line no-param-reassign -- enriching the passed-in error
        (error as Error & { expose: boolean }).expose = true;
    }

    try {
        return await run();
    } finally {
        if (hadOwnExpose) {
            // eslint-disable-next-line no-param-reassign -- restoring the passed-in error
            (error as Error & { expose?: boolean }).expose = previousExpose;
        } else {
            // eslint-disable-next-line no-param-reassign -- restoring the passed-in error
            delete (error as Error & { expose?: boolean }).expose;
        }
    }
};

export default withExpose;
