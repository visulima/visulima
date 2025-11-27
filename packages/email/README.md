<div align="center">
  <h3>visulima email</h3>
  <p>
  Email sending package with multiple provider support
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/email
```

```sh
yarn add @visulima/email
```

```sh
pnpm add @visulima/email
```

## Usage

### Basic Usage

```typescript
import { createMail, resendProvider } from "@visulima/email";

// Create a provider
const resend = resendProvider({
    apiKey: "re_xxx",
});

// Create a Mail instance
const mail = createMail(resend);

// Send an email using the message builder
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Hello").html("<h1>Hello World</h1>").send();

if (result.success) {
    console.log("Email sent:", result.data?.messageId);
}
```

### Using Different Providers

```typescript
import { createMail, smtpProvider, resendProvider } from "@visulima/email";

// SMTP provider
const smtp = smtpProvider({
    host: "smtp.example.com",
    port: 587,
    secure: true,
    user: "user@example.com",
    password: "password",
});

// Resend provider
const resend = resendProvider({
    apiKey: "re_xxx",
});

// Create Mail instances for each provider
const smtpMail = createMail(smtp);
const resendMail = createMail(resend);

// Send via specific provider
await resendMail.message().to("user@example.com").from("sender@example.com").subject("Hello").html("<h1>Hello World</h1>").send();
```

### Using Mailable Classes

```typescript
import { createMail, type Mailable, type EmailOptions } from "@visulima/email";
import { resendProvider } from "@visulima/email";

class WelcomeEmail implements Mailable {
    constructor(private user: { name: string; email: string }) {}

    build(): EmailOptions {
        return {
            from: { email: "noreply@example.com" },
            to: { email: this.user.email, name: this.user.name },
            subject: "Welcome!",
            html: `<h1>Welcome ${this.user.name}!</h1>`,
        };
    }
}

const mail = createMail(resendProvider({ apiKey: "re_xxx" }));
const result = await mail.send(new WelcomeEmail({ name: "John", email: "john@example.com" }));
```

### Direct Email Sending

```typescript
import { createMail, resendProvider, type EmailOptions } from "@visulima/email";

const mail = createMail(resendProvider({ apiKey: "re_xxx" }));

const emailOptions: EmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Hello",
    html: "<h1>Hello World</h1>",
};

const result = await mail.sendEmail(emailOptions);
```

### Failover Provider

The failover provider allows you to configure multiple email providers as backups. If the primary provider fails, it will automatically try the next provider in the list.

```typescript
import { createMail, failoverProvider, resendProvider, smtpProvider } from "@visulima/email";

// Create individual providers
const resend = resendProvider({ apiKey: "re_xxx" });
const smtp = smtpProvider({
    host: "smtp.example.com",
    port: 587,
    user: "user@example.com",
    password: "password",
});

// Create failover provider with multiple mailers
const failover = failoverProvider({
    mailers: [
        resend, // Try Resend first
        smtp, // Fallback to SMTP if Resend fails
    ],
    retryAfter: 60, // Wait 60ms before trying next provider (default: 60)
});

// Use failover provider
const mail = createMail(failover);

const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Hello").html("<h1>Hello World</h1>").send();

// The failover provider will try Resend first, and if it fails,
// automatically try SMTP
```

You can also use provider factories directly:

```typescript
import { failoverProvider, resendProvider, smtpProvider } from "@visulima/email";

const failover = failoverProvider({
    mailers: [
        resendProvider({ apiKey: "re_xxx" }), // Provider factory
        smtpProvider({
            // Provider factory
            host: "smtp.example.com",
            port: 587,
            user: "user@example.com",
            password: "password",
        }),
    ],
    retryAfter: 100, // Wait 100ms between attempts
});
```

### Round-Robin Provider

The round-robin provider distributes your email sending workload across multiple providers. Each email is sent using the next available provider in rotation, providing load balancing across your mailers.

```typescript
import { createMail, roundRobinProvider, resendProvider, smtpProvider } from "@visulima/email";

// Create individual providers
const resend = resendProvider({ apiKey: "re_xxx" });
const smtp = smtpProvider({
    host: "smtp.example.com",
    port: 587,
    user: "user@example.com",
    password: "password",
});

// Create round-robin provider with multiple mailers
const roundRobin = roundRobinProvider({
    mailers: [
        resend, // First provider
        smtp, // Second provider
    ],
    retryAfter: 60, // Wait 60ms before trying next provider if current is unavailable (default: 60)
});

// Use round-robin provider
const mail = createMail(roundRobin);

// Each email will be distributed across providers in rotation
await mail.message().to("user1@example.com").from("sender@example.com").subject("Email 1").html("<h1>Email 1</h1>").send();
// Uses resend (or random start)

await mail.message().to("user2@example.com").from("sender@example.com").subject("Email 2").html("<h1>Email 2</h1>").send();
// Uses smtp (next in rotation)

await mail.message().to("user3@example.com").from("sender@example.com").subject("Email 3").html("<h1>Email 3</h1>").send();
// Uses resend (back to first)
```

You can also use provider factories directly:

```typescript
import { roundRobinProvider, resendProvider, smtpProvider } from "@visulima/email";

const roundRobin = roundRobinProvider({
    mailers: [
        resendProvider({ apiKey: "re_xxx" }), // Provider factory
        smtpProvider({
            // Provider factory
            host: "smtp.example.com",
            port: 587,
            user: "user@example.com",
            password: "password",
        }),
    ],
    retryAfter: 100, // Wait 100ms between attempts
});
```

**Note:** The round-robin provider starts at a random provider and then rotates through providers for each subsequent email. If a provider is unavailable, it will automatically try the next provider in the rotation.

### Mailgun Provider

Mailgun is a developer-friendly email API service built for transactional emails and automated messaging.

```typescript
import { createMail, mailgunProvider } from "@visulima/email/providers/mailgun";

// Create Mailgun provider
const mailgun = mailgunProvider({
    apiKey: "your-mailgun-api-key",
    domain: "your-domain.com", // Required: Your Mailgun domain
    endpoint: "https://api.mailgun.net", // Optional: Use https://api.eu.mailgun.net for EU accounts
});

// Use Mailgun provider
const mail = createMail(mailgun);

// Send email with Mailgun-specific options
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Welcome").html("<h1>Welcome!</h1>").send();

// Or use Mailgun-specific features
import type { MailgunEmailOptions } from "@visulima/email/providers/mailgun";

const mailgunOptions: MailgunEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    template: "welcome-template", // Use Mailgun template
    templateVariables: { name: "John" }, // Template variables
    tags: ["welcome", "user"], // Tags for categorization
    clickTracking: true, // Enable click tracking
    openTracking: true, // Enable open tracking
    deliveryTime: Math.floor(Date.now() / 1000) + 3600, // Schedule for 1 hour from now
};

await mail.sendEmail(mailgunOptions);
```

### Mailjet Provider

Mailjet combines email marketing and transactional email capabilities, featuring a user-friendly email editor and support for SMTP relay.

```typescript
import { createMail, mailjetProvider } from "@visulima/email/providers/mailjet";

// Create Mailjet provider
const mailjet = mailjetProvider({
    apiKey: "your-mailjet-api-key",
    apiSecret: "your-mailjet-api-secret",
    endpoint: "https://api.mailjet.com", // Optional, defaults to this
});

// Use Mailjet provider
const mail = createMail(mailjet);

// Send email with Mailjet-specific options
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Welcome").html("<h1>Welcome!</h1>").send();

// Or use Mailjet-specific features
import type { MailjetEmailOptions } from "@visulima/email/providers/mailjet";

const mailjetOptions: MailjetEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: 12345, // Use Mailjet template ID
    templateVariables: { name: "John" }, // Template variables
    tags: ["welcome", "user"], // Tags (as CustomCampaign)
    campaign: "welcome-campaign", // Campaign name
    customId: "custom-123", // Custom tracking ID
    priority: 1, // Priority (1-5)
    deliveryTime: Math.floor(Date.now() / 1000) + 3600, // Schedule for 1 hour from now
};

await mail.sendEmail(mailjetOptions);
```

### MailerSend Provider

MailerSend is a modern email API designed for developers, offering comprehensive email delivery with templates, personalization, and analytics.

```typescript
import { createMail, mailerSendProvider } from "@visulima/email/providers/mailersend";

// Create MailerSend provider
const mailerSend = mailerSendProvider({
    apiToken: "your-mailersend-api-token",
    endpoint: "https://api.mailersend.com", // Optional, defaults to this
});

// Use MailerSend provider
const mail = createMail(mailerSend);

// Send email with MailerSend-specific options
import type { MailerSendEmailOptions } from "@visulima/email/providers/mailersend";

const mailerSendOptions: MailerSendEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: "template-uuid", // Use MailerSend template UUID
    templateVariables: { name: "John" }, // Template variables
    personalization: [
        {
            email: "user@example.com",
            data: { name: "John", orderId: "123" },
        },
    ],
    tags: ["welcome", "user"],
    scheduledAt: Math.floor(Date.now() / 1000) + 3600, // Schedule for 1 hour from now
};

await mail.sendEmail(mailerSendOptions);
```

### Mandrill Provider (Mailchimp Transactional)

Mandrill is Mailchimp's transactional email service, providing powerful email delivery with template support and merge variables.

```typescript
import { createMail, mandrillProvider } from "@visulima/email/providers/mandrill";

// Create Mandrill provider
const mandrill = mandrillProvider({
    apiKey: "your-mandrill-api-key",
    endpoint: "https://mandrillapp.com/api/1.0", // Optional, defaults to this
});

// Use Mandrill provider
const mail = createMail(mandrill);

// Send email with Mandrill-specific options
import type { MandrillEmailOptions } from "@visulima/email/providers/mandrill";

const mandrillOptions: MandrillEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateName: "welcome-template", // Use Mandrill template
    templateVariables: [{ name: "name", content: "John" }],
    globalMergeVars: [{ name: "company", content: "Acme Inc" }],
    tags: ["welcome", "user"],
    metadata: { orderId: "123" },
};

await mail.sendEmail(mandrillOptions);
```

### Postal Provider

Postal is a self-hosted email server that provides a complete email solution with webhooks, tracking, and more.

```typescript
import { createMail, postalProvider } from "@visulima/email/providers/postal";

// Create Postal provider
const postal = postalProvider({
    host: "your-postal-server.com",
    apiKey: "your-postal-api-key",
    endpoint: "https://your-postal-server.com/api/v1", // Optional, auto-generated from host
});

// Use Postal provider
const mail = createMail(postal);

// Send email with Postal-specific options
import type { PostalEmailOptions } from "@visulima/email/providers/postal";

const postalOptions: PostalEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: 123, // Use Postal template ID
    templateVariables: { name: "John" },
    tags: ["welcome"],
};

await mail.sendEmail(postalOptions);
```

### Mailtrap Provider

Mailtrap is an email testing platform that captures emails in development, making it perfect for testing email functionality.

```typescript
import { createMail, mailtrapProvider } from "@visulima/email/providers/mailtrap";

// Create Mailtrap provider
const mailtrap = mailtrapProvider({
    apiToken: "your-mailtrap-api-token",
    endpoint: "https://send.api.mailtrap.io", // Optional, defaults to this
});

// Use Mailtrap provider
const mail = createMail(mailtrap);

// Send email with Mailtrap-specific options
import type { MailtrapEmailOptions } from "@visulima/email/providers/mailtrap";

const mailtrapOptions: MailtrapEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateUuid: "template-uuid", // Use Mailtrap template UUID
    templateVariables: { name: "John" },
    category: "welcome",
    customVariables: { orderId: "123" },
    tags: ["welcome"],
};

await mail.sendEmail(mailtrapOptions);
```

### MailPace Provider

MailPace is a simple transactional email service focused on ease of use and reliability.

```typescript
import { createMail, mailPaceProvider } from "@visulima/email/providers/mailpace";

// Create MailPace provider
const mailPace = mailPaceProvider({
    apiToken: "your-mailpace-api-token",
    endpoint: "https://app.mailpace.com/api/v1", // Optional, defaults to this
});

// Use MailPace provider
const mail = createMail(mailPace);

// Send email with MailPace-specific options
import type { MailPaceEmailOptions } from "@visulima/email/providers/mailpace";

const mailPaceOptions: MailPaceEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: 123, // Use MailPace template ID
    templateVariables: { name: "John" },
    tags: ["welcome"],
    listUnsubscribe: "<mailto:unsubscribe@example.com>",
};

await mail.sendEmail(mailPaceOptions);
```

### Azure Communication Services Provider

Azure Communication Services provides email sending capabilities integrated with Microsoft Azure infrastructure.

```typescript
import { createMail, azureProvider } from "@visulima/email/providers/azure";

// Create Azure provider with access token
const azure = azureProvider({
    accessToken: "your-azure-access-token",
    region: "eastus", // Azure region (e.g., "eastus", "westus")
    endpoint: "https://eastus.communication.azure.com", // Optional, auto-generated from region
});

// Or use connection string
const azureWithConnectionString = azureProvider({
    connectionString: "endpoint=https://...;accesskey=...",
    region: "eastus",
});

// Use Azure provider
const mail = createMail(azure);

// Send email with Azure-specific options
import type { AzureEmailOptions } from "@visulima/email/providers/azure";

const azureOptions: AzureEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    importance: "high", // "normal" or "high"
};

await mail.sendEmail(azureOptions);
```

### Infobip Provider

Infobip is a global communication platform offering email delivery with comprehensive tracking and analytics.

```typescript
import { createMail, infobipProvider } from "@visulima/email/providers/infobip";

// Create Infobip provider
const infobip = infobipProvider({
    apiKey: "your-infobip-api-key",
    baseUrl: "https://api.infobip.com", // Optional, defaults to this
});

// Use Infobip provider
const mail = createMail(infobip);

// Send email with Infobip-specific options
import type { InfobipEmailOptions } from "@visulima/email/providers/infobip";

const infobipOptions: InfobipEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: 123,
    templateVariables: { name: "John" },
    trackingUrl: "https://example.com/track",
    notifyUrl: "https://example.com/webhook",
    sendAt: Date.now() + 3600000, // Schedule for 1 hour from now (milliseconds)
};

await mail.sendEmail(infobipOptions);
```

### Scaleway Provider

Scaleway provides email services as part of their European cloud platform.

```typescript
import { createMail, scalewayProvider } from "@visulima/email/providers/scaleway";

// Create Scaleway provider
const scaleway = scalewayProvider({
    apiKey: "your-scaleway-api-key",
    region: "fr-par", // Scaleway region (e.g., "fr-par", "nl-ams")
});

// Use Scaleway provider
const mail = createMail(scaleway);

// Send email with Scaleway-specific options
import type { ScalewayEmailOptions } from "@visulima/email/providers/scaleway";

const scalewayOptions: ScalewayEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: "template-uuid",
    templateVariables: { name: "John" },
    projectId: "project-uuid", // Optional
};

await mail.sendEmail(scalewayOptions);
```

### AhaSend Provider

AhaSend is an email delivery service with template support and tracking capabilities.

```typescript
import { createMail, ahaSendProvider } from "@visulima/email/providers/ahasend";

// Create AhaSend provider
const ahaSend = ahaSendProvider({
    apiKey: "your-ahasend-api-key",
    endpoint: "https://api.ahasend.com", // Optional, defaults to this
});

// Use AhaSend provider
const mail = createMail(ahaSend);

// Send email with AhaSend-specific options
import type { AhaSendEmailOptions } from "@visulima/email/providers/ahasend";

const ahaSendOptions: AhaSendEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: "template-id",
    templateVariables: { name: "John" },
    tags: ["welcome"],
};

await mail.sendEmail(ahaSendOptions);
```

### Mailomat Provider

Mailomat is an email service provider with webhook support and tracking features.

```typescript
import { createMail, mailomatProvider } from "@visulima/email/providers/mailomat";

// Create Mailomat provider
const mailomat = mailomatProvider({
    apiKey: "your-mailomat-api-key",
    endpoint: "https://api.mailomat.com", // Optional, defaults to this
});

// Use Mailomat provider
const mail = createMail(mailomat);

// Send email with Mailomat-specific options
import type { MailomatEmailOptions } from "@visulima/email/providers/mailomat";

const mailomatOptions: MailomatEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: "template-id",
    templateVariables: { name: "John" },
    tags: ["welcome"],
};

await mail.sendEmail(mailomatOptions);
```

### Sweego Provider

Sweego is an email delivery service with template support and tracking capabilities.

```typescript
import { createMail, sweegoProvider } from "@visulima/email/providers/sweego";

// Create Sweego provider
const sweego = sweegoProvider({
    apiKey: "your-sweego-api-key",
    endpoint: "https://api.sweego.com", // Optional, defaults to this
});

// Use Sweego provider
const mail = createMail(sweego);

// Send email with Sweego-specific options
import type { SweegoEmailOptions } from "@visulima/email/providers/sweego";

const sweegoOptions: SweegoEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: "template-id",
    templateVariables: { name: "John" },
    tags: ["welcome"],
};

await mail.sendEmail(sweegoOptions);
```

### Brevo Provider (formerly Sendinblue)

Brevo is a comprehensive email marketing and transactional email platform with a robust API.

```typescript
import { createMail, brevoProvider } from "@visulima/email/providers/brevo";

// Create Brevo provider
const brevo = brevoProvider({
    apiKey: "your-brevo-api-key",
    endpoint: "https://api.brevo.com/v3", // Optional, defaults to this
});

// Use Brevo provider
const mail = createMail(brevo);

// Send email with Brevo-specific options
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Welcome").html("<h1>Welcome!</h1>").send();

// Or use Brevo-specific features
import type { BrevoEmailOptions } from "@visulima/email/providers/brevo";

const brevoOptions: BrevoEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: 12345, // Use Brevo template ID
    templateParams: { name: "John" }, // Template parameters
    tags: ["welcome", "user"], // Tags for categorization
    scheduledAt: Math.floor(Date.now() / 1000) + 3600, // Schedule for 1 hour from now
};

await mail.sendEmail(brevoOptions);
```

### Postmark Provider

Postmark specializes in transactional email delivery with a focus on speed and reliability, offering a developer-friendly API and real-time analytics.

```typescript
import { createMail, postmarkProvider } from "@visulima/email/providers/postmark";

// Create Postmark provider
const postmark = postmarkProvider({
    serverToken: "your-postmark-server-token",
    endpoint: "https://api.postmarkapp.com", // Optional, defaults to this
});

// Use Postmark provider
const mail = createMail(postmark);

// Send email with Postmark-specific options
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Welcome").html("<h1>Welcome!</h1>").send();

// Or use Postmark-specific features
import type { PostmarkEmailOptions } from "@visulima/email/providers/postmark";

const postmarkOptions: PostmarkEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: 12345, // Use Postmark template ID
    templateAlias: "welcome-template", // Or use template alias
    templateModel: { name: "John" }, // Template variables
    tags: ["welcome"], // Tag (Postmark supports single tag)
    trackOpens: true, // Enable open tracking
    trackLinks: "HtmlAndText", // Track links in HTML and text
    metadata: { userId: "123" }, // Custom metadata
};

await mail.sendEmail(postmarkOptions);
```

### SendGrid Provider

SendGrid is a cloud-based email service for transactional and marketing emails, known for its scalability and robust API.

```typescript
import { createMail, sendGridProvider } from "@visulima/email/providers/sendgrid";

// Create SendGrid provider
const sendgrid = sendGridProvider({
    apiKey: "your-sendgrid-api-key",
    endpoint: "https://api.sendgrid.com/v3", // Optional, defaults to this
});

// Use SendGrid provider
const mail = createMail(sendgrid);

// Send email with SendGrid-specific options
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Welcome").html("<h1>Welcome!</h1>").send();

// Or use SendGrid-specific features
import type { SendGridEmailOptions } from "@visulima/email/providers/sendgrid";

const sendGridOptions: SendGridEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    templateId: "template-id", // Use SendGrid template
    templateData: { name: "John" }, // Template data
    sendAt: Math.floor(Date.now() / 1000) + 3600, // Schedule for 1 hour from now
    tags: ["welcome", "user"], // Tags as custom args
    trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
    },
};

await mail.sendEmail(sendGridOptions);
```

### Plunk Provider

Plunk is a modern email platform built on top of AWS SES, offering transactional emails, automations, and broadcasts.

```typescript
import { createMail, plunkProvider } from "@visulima/email/providers/plunk";

// Create Plunk provider
const plunk = plunkProvider({
    apiKey: "your-plunk-api-key",
    endpoint: "https://api.useplunk.com/v1", // Optional, defaults to this
});

// Use Plunk provider
const mail = createMail(plunk);

// Send email with Plunk-specific options
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Welcome").html("<h1>Welcome!</h1>").send();

// Or use Plunk-specific features
import type { PlunkEmailOptions } from "@visulima/email/providers/plunk";

const plunkOptions: PlunkEmailOptions = {
    from: { email: "sender@example.com" },
    to: { email: "user@example.com" },
    subject: "Welcome",
    html: "<h1>Welcome!</h1>",
    subscriber: "user@example.com", // For tracking
    subscriberId: "user-123", // Optional subscriber ID
    templateId: "template-id", // Use template
    data: { name: "John" }, // Template data
};

await mail.sendEmail(plunkOptions);
```

### Mock Provider (for Testing)

The mock provider is designed for testing and development. It stores emails in memory without actually sending them, allowing you to test your email logic without hitting real email services.

```typescript
import { createMail, mockProvider } from "@visulima/email/providers/mock";

// Create mock provider
const mock = mockProvider({
    debug: true, // Enable debug logging
    delay: 100, // Simulate 100ms delay
    failureRate: 0.1, // 10% failure rate for testing error handling
});

// Use mock provider
const mail = createMail(mock);

// Send email (stored in memory)
const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Test").html("<h1>Test</h1>").send();

// Access stored emails
const sentEmails = mock.getSentEmails();
console.log(`Sent ${sentEmails.length} emails`);

// Get last sent message
const lastMessage = mock.getLastSentMessage();
console.log("Last subject:", lastMessage?.options.subject);

// Find messages by criteria
const welcomeEmails = mock.getMessagesBySubject("Welcome");
const userEmails = mock.getMessagesTo("user@example.com");

// Simulate failures for testing
mock.setFailureRate(1.0); // Always fail
mock.setNextResponse({
    successful: false,
    errorMessages: ["Test error"],
});

// Clear stored messages
mock.clearSentMessages();

// Reset provider to initial state
mock.reset();
```

**Mock Provider Helper Methods:**

- `getSentEmails()` / `getSentMessages()` - Get all sent emails
- `getLastSentMessage()` - Get the last sent message
- `getSentMessagesCount()` - Get count of sent messages
- `clearSentMessages()` - Clear all stored messages
- `setNextResponse(receipt)` - Set response for next send (one-time)
- `setDefaultResponse(receipt)` - Set default response
- `setFailureRate(rate)` - Set failure rate (0.0 to 1.0)
- `setDelay(ms)` - Set fixed delay
- `setRandomDelay(min, max)` - Set random delay range
- `findMessageBy(predicate)` - Find first matching message
- `findMessagesBy(predicate)` - Find all matching messages
- `getMessagesTo(email)` - Get messages sent to email
- `getMessagesBySubject(subject)` - Get messages by subject
- `waitForMessageCount(count, timeout)` - Wait for message count
- `waitForMessage(predicate, timeout)` - Wait for matching message
- `reset()` - Reset to initial state

### MailCrab Provider (for Development)

MailCrab is a local SMTP server for testing emails during development. This provider is a convenience wrapper around the SMTP provider with MailCrab defaults.

```typescript
import { createMail, mailCrabProvider } from "@visulima/email";

// Create MailCrab provider with default settings (localhost:1025)
const mailCrab = mailCrabProvider({});

// Or customize the connection
const customMailCrab = mailCrabProvider({
    host: "localhost",
    port: 1025, // Default MailCrab port
    secure: false, // Typically false for development
});

// Use MailCrab provider
const mail = createMail(mailCrab);

const result = await mail.message().to("user@example.com").from("sender@example.com").subject("Test Email").html("<h1>Test</h1>").send();
```

**Note:** Make sure MailCrab is running locally before using this provider. MailCrab can be installed via Docker or as a standalone application.

## Supported Providers

- **AWS SES** - Amazon Simple Email Service
- **Brevo** - Email marketing and transactional email platform (formerly Sendinblue)
- **Failover** - Automatic failover between multiple providers
- **HTTP** - Generic HTTP API provider
- **MailCrab** - Local development email testing (SMTP wrapper)
- **Mailgun** - Developer-friendly email API service
- **Mailjet** - Email marketing and transactional email platform
- **MailerSend** - Modern email API for developers
- **Mandrill** - Mailchimp Transactional Email (formerly Mandrill)
- **MailPace** - Simple transactional email service
- **Mailtrap** - Email testing and development tool
- **Mock** - In-memory provider for testing (no actual emails sent)
- **Azure** - Microsoft Azure Communication Services
- **Infobip** - Global communication platform
- **Scaleway** - European cloud provider email service
- **AhaSend** - Email delivery service
- **Mailomat** - Email service provider
- **Sweego** - Email delivery service
- **Postal** - Self-hosted email server
- **Nodemailer** - Popular Node.js email library wrapper
- **Plunk** - Modern email platform built on AWS SES
- **Postmark** - Transactional email service focused on deliverability
- **Resend** - Resend email service
- **Round Robin** - Load balancing across multiple providers
- **OpenTelemetry** - OpenTelemetry instrumentation wrapper for observability
- **SendGrid** - Cloud-based email service for transactional and marketing emails
- **SMTP** - Standard SMTP protocol
- **Zeptomail** - Zeptomail email service

## Runtime Support

@visulima/email is designed to work across multiple JavaScript runtimes. However, some providers have specific runtime requirements:

### Universal Providers (All Runtimes)

These providers work in **Node.js**, **Deno**, **Bun**, and **Cloudflare Workers**:

- ✅ **Resend** - Uses Fetch API
- ✅ **HTTP** - Uses Fetch API
- ✅ **Zeptomail** - Uses Fetch API
- ✅ **Brevo** - Uses Fetch API
- ✅ **Mailgun** - Uses Fetch API
- ✅ **Mailjet** - Uses Fetch API
- ✅ **MailerSend** - Uses Fetch API
- ✅ **Mandrill** - Uses Fetch API
- ✅ **MailPace** - Uses Fetch API
- ✅ **Mailtrap** - Uses Fetch API
- ✅ **Postal** - Uses Fetch API
- ✅ **Postmark** - Uses Fetch API
- ✅ **Azure** - Uses Fetch API (requires OAuth2 token or connection string)
- ✅ **Infobip** - Uses Fetch API
- ✅ **Scaleway** - Uses Fetch API
- ✅ **AhaSend** - Uses Fetch API
- ✅ **Mailomat** - Uses Fetch API
- ✅ **Sweego** - Uses Fetch API
- ✅ **SendGrid** - Uses Fetch API
- ✅ **Plunk** - Uses Fetch API
- ✅ **Mock** - In-memory provider, works everywhere
- ✅ **Failover** - Runtime depends on wrapped providers (works if all wrapped providers support the runtime)
- ✅ **Round Robin** - Runtime depends on wrapped providers (works if all wrapped providers support the runtime)
- ✅ **OpenTelemetry** - Runtime depends on wrapped provider (works if wrapped provider supports the runtime)

### Node.js Only Providers

These providers require Node.js built-in modules and only work in **Node.js**:

- ⚠️ **AWS SES** - Requires `node:crypto` for AWS Signature V4 signing
- ⚠️ **SMTP** - Requires `node:net` and `node:tls` for SMTP connections
- ⚠️ **MailCrab** - Wraps SMTP provider (requires Node.js)
- ⚠️ **Nodemailer** - Requires the `nodemailer` package (Node.js only)

### Template Engines

Template engines are optional peer dependencies and work where their underlying packages are supported:

- **Handlebars** - Works in Node.js, Deno, Bun (where `handlebars` package is available)
- **MJML** - Works in Node.js, Deno, Bun (where `mjml` package is available)
- **React Email** - Works in Node.js, Deno, Bun (where `@react-email/render` package is available)
- **Vue Email** - Works in Node.js, Deno, Bun (where `@vue-email/render` package is available)
- **HTML-to-Text** - Works in Node.js, Deno, Bun (where `html-to-text` package is available)

### Runtime Requirements Summary

| Provider      | Node.js | Deno | Bun  | Cloudflare Workers |
| ------------- | ------- | ---- | ---- | ------------------ |
| Resend        | ✅      | ✅   | ✅   | ✅                 |
| HTTP          | ✅      | ✅   | ✅   | ✅                 |
| Zeptomail     | ✅      | ✅   | ✅   | ✅                 |
| Brevo         | ✅      | ✅   | ✅   | ✅                 |
| Mailgun       | ✅      | ✅   | ✅   | ✅                 |
| Mailjet       | ✅      | ✅   | ✅   | ✅                 |
| MailerSend    | ✅      | ✅   | ✅   | ✅                 |
| Mandrill      | ✅      | ✅   | ✅   | ✅                 |
| MailPace      | ✅      | ✅   | ✅   | ✅                 |
| Mailtrap      | ✅      | ✅   | ✅   | ✅                 |
| Postal        | ✅      | ✅   | ✅   | ✅                 |
| Postmark      | ✅      | ✅   | ✅   | ✅                 |
| Azure         | ✅      | ✅   | ✅   | ✅                 |
| Infobip       | ✅      | ✅   | ✅   | ✅                 |
| Scaleway      | ✅      | ✅   | ✅   | ✅                 |
| AhaSend       | ✅      | ✅   | ✅   | ✅                 |
| Mailomat      | ✅      | ✅   | ✅   | ✅                 |
| Sweego        | ✅      | ✅   | ✅   | ✅                 |
| SendGrid      | ✅      | ✅   | ✅   | ✅                 |
| Plunk         | ✅      | ✅   | ✅   | ✅                 |
| Mock          | ✅      | ✅   | ✅   | ✅                 |
| AWS SES       | ✅      | ❌   | ❌   | ❌                 |
| SMTP          | ✅      | ❌   | ❌   | ❌                 |
| MailCrab      | ✅      | ❌   | ❌   | ❌                 |
| Nodemailer    | ✅      | ❌   | ❌   | ❌                 |
| Failover      | ✅\*    | ✅\* | ✅\* | ✅\*               |
| Round Robin   | ✅\*    | ✅\* | ✅\* | ✅\*               |
| OpenTelemetry | ✅\*    | ✅\* | ✅\* | ✅\*               |

\* Runtime support depends on the wrapped providers. Works if all wrapped providers support the runtime.

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima email is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/email?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/email/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/email/v/latest "npm"
