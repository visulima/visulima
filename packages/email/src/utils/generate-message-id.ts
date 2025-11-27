/**
 * Generates a unique message ID for email messages.
 * @returns A unique message ID in the format &lt;timestamp.random@visulima.local>.
 */
const generateMessageId = (): string => {
    const domain = "visulima.local";
    const timestamp = Date.now();
    // eslint-disable-next-line sonarjs/pseudo-random
    const random = Math.random().toString(36).slice(2, 10);

    return `<${timestamp}.${random}@${domain}>`;
};

export default generateMessageId;
