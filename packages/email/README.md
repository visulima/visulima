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

### Round Robin Provider

The round robin provider distributes your email sending workload across multiple providers. Each email is sent using the next available provider in rotation, providing load balancing across your mailers.

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

// Create round robin provider with multiple mailers
const roundRobin = roundRobinProvider({
    mailers: [
        resend, // First provider
        smtp, // Second provider
    ],
    retryAfter: 60, // Wait 60ms before trying next provider if current is unavailable (default: 60)
});

// Use round robin provider
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

**Note:** The round robin provider starts at a random provider and then rotates through providers for each subsequent email. If a provider is unavailable, it will automatically try the next provider in the rotation.

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
const result = await mail.message()
    .to("user@example.com")
    .from("sender@example.com")
    .subject("Welcome")
    .html("<h1>Welcome!</h1>")
    .send();

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
const result = await mail.message()
    .to("user@example.com")
    .from("sender@example.com")
    .subject("Test")
    .html("<h1>Test</h1>")
    .send();

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
const mailCrab = mailCrabProvider({
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
- **Failover** - Automatic failover between multiple providers
- **HTTP** - Generic HTTP API provider
- **MailCrab** - Local development email testing (SMTP wrapper)
- **Mock** - In-memory provider for testing (no actual emails sent)
- **Nodemailer** - Popular Node.js email library wrapper
- **Plunk** - Modern email platform built on AWS SES
- **Resend** - Resend email service
- **Round Robin** - Load balancing across multiple providers
- **SMTP** - Standard SMTP protocol
- **Zeptomail** - Zeptomail email service

## Runtime Support

@visulima/email is designed to work across multiple JavaScript runtimes. However, some providers have specific runtime requirements:

### Universal Providers (All Runtimes)

These providers work in **Node.js**, **Deno**, **Bun**, and **Cloudflare Workers**:

- ✅ **Resend** - Uses Fetch API
- ✅ **HTTP** - Uses Fetch API
- ✅ **Zeptomail** - Uses Fetch API
- ✅ **Plunk** - Uses Fetch API
- ✅ **Mock** - In-memory provider, works everywhere
- ✅ **Failover** - Runtime depends on wrapped providers (works if all wrapped providers support the runtime)
- ✅ **Round Robin** - Runtime depends on wrapped providers (works if all wrapped providers support the runtime)

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

| Provider    | Node.js | Deno | Bun  | Cloudflare Workers |
| ----------- | ------- | ---- | ---- | ------------------ |
| Resend      | ✅      | ✅   | ✅   | ✅                 |
| HTTP        | ✅      | ✅   | ✅   | ✅                 |
| Zeptomail   | ✅      | ✅   | ✅   | ✅                 |
| Plunk       | ✅      | ✅   | ✅   | ✅                 |
| Mock        | ✅      | ✅   | ✅   | ✅                 |
| AWS SES     | ✅      | ❌   | ❌   | ❌                 |
| SMTP        | ✅      | ❌   | ❌   | ❌                 |
| MailCrab    | ✅      | ❌   | ❌   | ❌                 |
| Nodemailer  | ✅      | ❌   | ❌   | ❌                 |
| Failover    | ✅\*    | ✅\* | ✅\* | ✅\*               |
| Round Robin | ✅\*    | ✅\* | ✅\* | ✅\*               |

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
