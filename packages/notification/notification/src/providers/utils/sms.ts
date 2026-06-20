import NotificationError from "../../errors/notification-error";
import type { NotificationResult, RecipientResult, Result } from "../../types";

/**
 * Folds per-recipient results into a single provider {@link Result}. Succeeds when at
 * least one recipient was delivered; the first sent message id becomes the top-level id.
 * @param provider The provider id.
 * @param results Per-recipient delivery results.
 * @returns A success result with the recipient breakdown, or a failure when all failed.
 */
export const aggregateSmsResults = (provider: string, results: RecipientResult[]): Result<NotificationResult> => {
    const sent = results.filter((result) => result.status === "sent");

    if (sent.length === 0) {
        return { error: new NotificationError(provider, results[0]?.error ?? "All recipients failed"), success: false };
    }

    return {
        data: {
            channel: "sms",
            messageId: sent[0]?.messageId ?? "",
            provider,
            recipients: results,
            sent: true,
            timestamp: new Date(),
        },
        success: true,
    };
};

/**
 * Runs a per-recipient send function sequentially and collects the results.
 * @param recipients The recipient list.
 * @param sendOne The function invoked per recipient.
 * @returns The collected per-recipient results.
 */
export const sendSequential = async (recipients: string[], sendOne: (to: string) => Promise<RecipientResult>): Promise<RecipientResult[]> => {
    const results: RecipientResult[] = [];

    for (const to of recipients) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await sendOne(to));
    }

    return results;
};
