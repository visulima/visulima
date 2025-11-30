import MailMessage from "./mail-message";

/**
 * Draft mail message - extends MailMessage with X-Unsent header automatically set.
 * Draft messages cannot be sent directly - they must be converted to regular messages first.
 */
export class DraftMailMessage extends MailMessage {
    /**
     * Creates a new draft mail message.
     * The X-Unsent header is automatically set to '1' to mark this as a draft.
     */
    public constructor() {
        super();
        this.header("X-Unsent", "1");
    }
}

export default DraftMailMessage;
