/**
 * Example: Using Nodemailer Provider with SMTP Transport
 *
 * This example demonstrates how to use the nodemailer provider
 * with a standard SMTP transport configuration.
 */

import { createMail } from "@visulima/email";
import { nodemailerProvider } from "@visulima/email/providers/nodemailer";

const main = async () => {
    // Create nodemailer provider with SMTP transport
    const provider = nodemailerProvider({
        transport: {
            host: process.env.SMTP_HOST || "smtp.example.com",
            port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
            secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || "user@example.com",
                pass: process.env.SMTP_PASSWORD || "password",
            },
            // Optional: Add TLS options
            tls: {
                // Do not fail on invalid certs
                rejectUnauthorized: false,
            },
        },
        defaultFrom: {
            email: process.env.FROM_EMAIL || "sender@example.com",
            name: "Example Sender",
        },
    });

    // Create mail instance
    const mail = createMail(provider);

    // Initialize the provider (verifies connection)
    await mail.initialize();

    // Send email using message builder
    const result = await mail
        .message()
        .to("recipient@example.com")
        .from("sender@example.com")
        .subject("Hello from Nodemailer SMTP")
        .html("<h1>Hello World</h1><p>This email was sent using Nodemailer with SMTP transport.</p>")
        .text("Hello World\n\nThis email was sent using Nodemailer with SMTP transport.")
        .send();

    if (result.success) {
        console.log("✅ Email sent successfully!");
        console.log("Message ID:", result.data?.messageId);
        console.log("Provider:", result.data?.provider);
    } else {
        console.error("❌ Failed to send email:", result.error?.message);
        process.exit(1);
    }

    // Cleanup
    await mail.shutdown();
};

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});

