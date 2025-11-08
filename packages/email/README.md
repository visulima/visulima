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
import { Mail, resendProvider } from "@visulima/email";

// Create a provider
const resend = resendProvider({
  apiKey: "re_xxx",
});

// Set as default mailer
Mail.setDefaultMailer(resend);

// Send an email
const result = await Mail.to("user@example.com")
  .from("sender@example.com")
  .subject("Hello")
  .html("<h1>Hello World</h1>")
  .send();

if (result.success) {
  console.log("Email sent:", result.data?.messageId);
}
```

### Using Different Providers

```typescript
import { Mail, smtpProvider, resendProvider } from "@visulima/email";

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

// Send via specific provider
await Mail.mailer(resend)
  .to("user@example.com")
  .from("sender@example.com")
  .subject("Hello")
  .html("<h1>Hello World</h1>")
  .send();
```

### Using Mailable Classes

```typescript
import { Mail, type Mailable, type EmailOptions } from "@visulima/email";

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

const result = await Mail.send(new WelcomeEmail({ name: "John", email: "john@example.com" }));
```

## Supported Providers

- **AWS SES** - Amazon Simple Email Service
- **HTTP** - Generic HTTP API provider
- **Resend** - Resend email service
- **SMTP** - Standard SMTP protocol
- **Zeptomail** - Zeptomail email service

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima email is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/email?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/email/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/email/v/latest "npm"
