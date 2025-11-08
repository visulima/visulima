export { defineProvider } from "./provider.js";
export type { Provider, ProviderFactory } from "./provider.js";

// Export all providers
export { awsSesProvider } from "./aws-ses/index.js";
export type { AwsSesEmailOptions } from "./aws-ses/index.js";

export { httpProvider } from "./http/index.js";
export type { HttpEmailOptions } from "./http/index.js";

export { resendProvider } from "./resend/index.js";
export type { ResendEmailOptions, ResendEmailTag } from "./resend/index.js";

export { smtpProvider } from "./smtp/index.js";
export type { SmtpEmailOptions } from "./smtp/index.js";

export { zeptomailProvider } from "./zeptomail/index.js";
export type { ZeptomailEmailOptions } from "./zeptomail/index.js";

export { failoverProvider } from "./failover/index.js";
export type { FailoverEmailOptions } from "./failover/index.js";

export { roundRobinProvider } from "./roundrobin/index.js";
export type { RoundRobinEmailOptions } from "./roundrobin/index.js";

export { mailCrabProvider } from "./mailcrab/index.js";
export type { MailCrabEmailOptions } from "./mailcrab/index.js";
