/**
 * Example: Using Nodemailer Provider with Custom Transport and Advanced Features
 *
 * This example demonstrates advanced features of the nodemailer provider:
 * - Custom transport configuration
 * - Transport override per email
 * - Attachments
 * - CC/BCC
 * - Reply-To
 * - Custom headers
 */

import { createMail, MailMessage } from "@visulima/email";
import { nodemailerProvider } from "@visulima/email/providers/nodemailer";

const main = async () => {
    // Create nodemailer provider with custom SMTP transport
    const provider = nodemailerProvider({
        transport: {
            host: process.env.SMTP_HOST || "smtp.example.com",
            port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER || "user@example.com",
                pass: process.env.SMTP_PASSWORD || "password",
            },
            // Connection pool options
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            // Rate limiting
            rateDelta: 1000, // 1 second
            rateLimit: 5, // 5 messages per rateDelta
        },
        defaultFrom: {
            email: process.env.FROM_EMAIL || "sender@example.com",
            name: "Example Sender",
        },
    });

    // Create mail instance
    const mail = createMail(provider);

    // Initialize the provider
    await mail.initialize();

    // Example 1: Basic email with HTML and text
    console.log("Sending basic email...");
    const message1 = new MailMessage()
        .to("recipient@example.com")
        .from("sender@example.com")
        .subject("Basic Email Example")
        .html("<h1>Hello</h1><p>This is a basic email.</p>")
        .text("Hello\n\nThis is a basic email.");

    const result1 = await mail.send(message1);

    if (result1.success) {
        console.log("✅ Basic email sent:", result1.data?.messageId);
    } else {
        console.error("❌ Failed:", result1.error?.message);
    }

    // Example 2: Email with CC, BCC, and Reply-To
    console.log("\nSending email with CC, BCC, and Reply-To...");
    const message2 = new MailMessage()
        .to("recipient@example.com")
        .cc("cc@example.com")
        .bcc("bcc@example.com")
        .from("sender@example.com")
        .replyTo("reply@example.com")
        .subject("Email with CC, BCC, and Reply-To")
        .html("<h1>Hello</h1><p>This email has CC, BCC, and Reply-To headers.</p>");

    const result2 = await mail.send(message2);

    if (result2.success) {
        console.log("✅ Email with CC/BCC sent:", result2.data?.messageId);
    } else {
        console.error("❌ Failed:", result2.error?.message);
    }

    // Example 3: Email with attachments
    console.log("\nSending email with attachments...");
    const message3 = new MailMessage()
        .to("recipient@example.com")
        .from("sender@example.com")
        .subject("Email with Attachments")
        .html("<h1>Hello</h1><p>This email has attachments.</p>")
        .attachment({
            filename: "example.txt",
            content: "This is a text file attachment.",
            contentType: "text/plain",
        })
        .attachment({
            filename: "example.json",
            content: JSON.stringify({ message: "Hello from attachment" }, null, 2),
            contentType: "application/json",
        });

    const result3 = await mail.send(message3);

    if (result3.success) {
        console.log("✅ Email with attachments sent:", result3.data?.messageId);
    } else {
        console.error("❌ Failed:", result3.error?.message);
    }

    // Example 4: Email with custom headers
    console.log("\nSending email with custom headers...");
    const message4 = new MailMessage()
        .to("recipient@example.com")
        .from("sender@example.com")
        .subject("Email with Custom Headers")
        .html("<h1>Hello</h1><p>This email has custom headers.</p>")
        .header("X-Custom-Header", "custom-value")
        .header("X-Priority", "1");

    const result4 = await mail.send(message4);

    if (result4.success) {
        console.log("✅ Email with custom headers sent:", result4.data?.messageId);
    } else {
        console.error("❌ Failed:", result4.error?.message);
    }

    // Example 5: Email with transport override (use different transport for this email)
    // Note: Transport override must be passed via send directly, not through message builder
    console.log("\nSending email with transport override...");
    const result5 = await mail.send({
        to: "recipient@example.com",
        from: "sender@example.com",
        subject: "Email with Transport Override",
        html: "<h1>Hello</h1><p>This email uses a different transport.</p>",
        transportOverride: {
            host: process.env.ALTERNATE_SMTP_HOST || "smtp2.example.com",
            port: Number.parseInt(process.env.ALTERNATE_SMTP_PORT || "587", 10),
            secure: false,
            auth: {
                user: process.env.ALTERNATE_SMTP_USER || "user2@example.com",
                pass: process.env.ALTERNATE_SMTP_PASSWORD || "password2",
            },
        },
    });

    if (result5.success) {
        console.log("✅ Email with transport override sent:", result5.data?.messageId);
    } else {
        console.error("❌ Failed:", result5.error?.message);
    }

    // Example 6: Multiple recipients
    console.log("\nSending email to multiple recipients...");
    const message6 = new MailMessage()
        .to([
            { email: "recipient1@example.com", name: "Recipient 1" },
            { email: "recipient2@example.com", name: "Recipient 2" },
        ])
        .from("sender@example.com")
        .subject("Email to Multiple Recipients")
        .html("<h1>Hello</h1><p>This email is sent to multiple recipients.</p>");

    const result6 = await mail.send(message6);

    if (result6.success) {
        console.log("✅ Email to multiple recipients sent:", result6.data?.messageId);
    } else {
        console.error("❌ Failed:", result6.error?.message);
    }

    // Cleanup
    await mail.shutdown();
    console.log("\n✅ All examples completed!");
};

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
