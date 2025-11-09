/**
 * Generates a random message ID for emails
 */
export const generateMessageId = (): string => {
    const domain = "visulima.local";
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);

    return `<${timestamp}.${random}@${domain}>`;
};
