import type { BaseConfig } from "../../../types";

export interface TwilioConfig extends BaseConfig {
    /** Twilio Account SID. */
    accountSid: string;
    /** Twilio Auth Token. */
    authToken: string;
    /** Override the API base URL. */
    endpoint?: string;
    /** Default sender phone number or Messaging Service SID. */
    from?: string;
    /** Use `MessagingServiceSid` instead of `From` when `from` looks like a service SID. */
    messagingServiceSid?: string;
}
