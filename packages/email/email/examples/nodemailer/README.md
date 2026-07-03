# Nodemailer Provider Examples

This directory contains examples demonstrating how to use the Nodemailer provider with `@visulima/email`.

## Prerequisites

- Node.js 20.19 or higher
- `nodemailer` package (installed as a dependency)

## Examples

### 1. SMTP Transport (`smtp.ts`)

Basic example using SMTP transport. This is the most common use case.

```bash
# Set environment variables
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER=user@example.com
export SMTP_PASSWORD=password
export FROM_EMAIL=sender@example.com

# Run the example
pnpm run smtp
```

### 2. Gmail (`gmail.ts`)

Example using Gmail SMTP. **Important**: Gmail requires an App Password, not your regular password.

```bash
# Set environment variables
export GMAIL_USER=your-email@gmail.com
export GMAIL_APP_PASSWORD=your-app-password

# Run the example
pnpm run gmail
```

**Note**: To generate a Gmail App Password:

1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Generate an App Password for "Mail"

### 3. Sendmail (`sendmail.ts`)

Example using the system sendmail command. Useful for Unix/Linux systems.

```bash
# Set environment variables (optional)
export SENDMAIL_PATH=/usr/sbin/sendmail
export FROM_EMAIL=sender@example.com

# Run the example
pnpm run sendmail
```

### 4. Custom Transport (`custom-transport.ts`)

Advanced example demonstrating:

- Connection pooling
- Rate limiting
- Attachments
- CC/BCC
- Reply-To
- Custom headers
- Transport override per email
- Multiple recipients

```bash
# Set environment variables
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_USER=user@example.com
export SMTP_PASSWORD=password
export FROM_EMAIL=sender@example.com

# Optional: For transport override example
export ALTERNATE_SMTP_HOST=smtp2.example.com
export ALTERNATE_SMTP_PORT=587
export ALTERNATE_SMTP_USER=user2@example.com
export ALTERNATE_SMTP_PASSWORD=password2

# Run the example
pnpm run custom
```

## Available Nodemailer Transports

The Nodemailer provider supports all Nodemailer transports:

- **SMTP** - Standard SMTP protocol
- **Sendmail** - System sendmail command
- **Stream** - Stream transport (for testing)
- **JSONTransport** - JSON transport (for testing)
- **Custom transports** - Any custom Nodemailer transport

For more information about Nodemailer transports, see the [Nodemailer documentation](https://nodemailer.com/transports/).

## Configuration Options

### NodemailerConfig

```typescript
interface NodemailerConfig {
    // Nodemailer transport configuration
    transport: Record<string, unknown> | string;

    // Optional: Default from address
    defaultFrom?: {
        email: string;
        name?: string;
    };
}
```

### NodemailerEmailOptions

```typescript
interface NodemailerEmailOptions extends EmailOptions {
    // Optional: Override transport for this specific email
    transportOverride?: Record<string, unknown> | string;
}
```

## Common SMTP Configuration

```typescript
const provider = nodemailerProvider({
    transport: {
        host: "smtp.example.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: "user@example.com",
            pass: "password",
        },
        // Optional TLS options
        tls: {
            rejectUnauthorized: false, // WARNING: Only for development! Enable in production.
        },
    },
});
```

## Connection Pooling

For high-volume email sending, you can enable connection pooling:

```typescript
const provider = nodemailerProvider({
    transport: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
            user: "user@example.com",
            pass: "password",
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
    },
});
```

## Rate Limiting

You can add rate limiting to prevent overwhelming the SMTP server:

```typescript
const provider = nodemailerProvider({
    transport: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
            user: "user@example.com",
            pass: "password",
        },
        rateDelta: 1000, // 1 second
        rateLimit: 5, // 5 messages per rateDelta
    },
});
```

## Running Examples

All examples can be run with:

```bash
# Install dependencies
pnpm install

# Run a specific example
pnpm run smtp
pnpm run gmail
pnpm run sendmail
pnpm run custom

# Or use tsx directly
tsx smtp.ts
tsx gmail.ts
tsx sendmail.ts
tsx custom-transport.ts
```

## Troubleshooting

### Connection Errors

- Verify SMTP credentials are correct
- Check firewall settings
- Ensure the SMTP port is open
- For Gmail, use an App Password instead of your regular password

### Authentication Errors

- Verify username and password are correct
- For Gmail, ensure 2-Step Verification is enabled and use an App Password
- Check if your email provider requires OAuth2 instead of basic auth

### TLS/SSL Errors

- Set `secure: true` for port 465
- Set `secure: false` for ports 587, 25, etc.
- For self-signed certificates in development only, set `tls: { rejectUnauthorized: false }` (never use in production)

## More Information

- [Nodemailer Documentation](https://nodemailer.com/about/)
- [@visulima/email Documentation](https://visulima.com/packages/email)
- [Nodemailer Transports](https://nodemailer.com/transports/)
