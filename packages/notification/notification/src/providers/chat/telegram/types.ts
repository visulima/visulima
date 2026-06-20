import type { BaseConfig } from "../../../types";

export interface TelegramConfig extends BaseConfig {
    /** Telegram bot token (`123456:ABC-DEF...`). Required. */
    botToken: string;
    /** Default chat id used when the payload omits `to`. */
    defaultChatId?: number | string;
    /** Override the API base URL. */
    endpoint?: string;
    /** Default parse mode (`MarkdownV2`, `HTML`, ...). */
    parseMode?: string;
}
