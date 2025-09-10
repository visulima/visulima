export type Theme = "dark" | "light";


/**
 * Set of options accepted by ono when rendering error
 * to HTML
 */
export type OnoHTMLOptions = {
    /**
     * CSP nonce to define on inline style and script tags
     */
    cspNonce?: string;

    /**
     * Number of lines of code to display for the error stack frame.
     * For example: If you set the frameSourceBuffer=7, then 3 lines
     * above the error line and 3 lines after the error line will
     * be displayed.
     */
    frameSourceBuffer?: number;

    /**
     * Define the name of the IDE in which to open the files when
     * the filename anchor tag is clicked.
     *
     * Following is the list of supported editors
     *
     * - textmate
     * - macvim
     * - emacs
     * - sublime
     * - phpstorm
     * - atom
     * - vscode
     *
     * You can also specify the URL for the editor via the `ide` property. Make
     * sure to specify the placeholders for the filename and the line number
     * as follows.
     *
     * someprotocol://file/%f:%l
     *
     * - %f is the filename placeholder
     * - %l is the line number placeholder
     */
    ide?: string;

    /**
     * Define the offset to skip certain stack frames from
     * the top
     */
    offset?: number;

    /**
     * Specify the HTTP request properties to be printed as
     * metadata under the "Request" group
     */
    request?: {
        headers?: Record<string, string | string[] | undefined>;
        method?: string;
        url?: string;
    };

    /**
     * Define the error title. It could be the HTTP status
     * text
     */
    title?: string;
};

/**
 * Set of options accepted by ono when rendering error
 * to ANSI output
 */
export type OnoANSIOptions = {
    /**
     * Number of lines of code to display for the error stack frame.
     * For example: If you set the frameSourceBuffer=7, then 3 lines
     * above the error line and 3 lines after the error line will
     * be displayed.
     */
    frameSourceBuffer?: number;

    /**
     * Define the offset to skip certain stack frames from
     * the top
     */
    offset?: number;
};
