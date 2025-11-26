/**
 * Generates a random message ID for emails
 * @returns A unique message ID in the format &lt;timestamp.random@visulima.local>
 */
const generateMessageId = (): string => {
    const domain = "visulima.local";
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);

    return `<${timestamp}.${random}@${domain}>`;
};

export default generateMessageId;
