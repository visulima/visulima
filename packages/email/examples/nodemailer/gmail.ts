/**
 * Example: Using Nodemailer Provider with Gmail
 *
 * This example demonstrates how to use the nodemailer provider
 * with Gmail SMTP. Note: Gmail requires an App Password for authentication.
 */

import { createMail } from "@visulima/email";
import { nodemailerProvider } from "@visulima/email/providers/nodemailer";

const main = async () => {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error("Error: GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required");
        console.error("Set them in your .env file or export them before running this script");
        process.exit(1);
    }

    // Create nodemailer provider with Gmail SMTP
    const provider = nodemailerProvider({
        transport: {
            service: "gmail", // Use Gmail service
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
            },
        },
        defaultFrom: {
            email: process.env.GMAIL_USER,
            name: "Your Name",
        },
    });

    // Create mail instance
    const mail = createMail(provider);

    // Initialize the provider (verifies connection)
    await mail.initialize();

    // Send email with attachments
    const result = await mail
        .message()
        .to("recipient@example.com")
        .from("your-email@gmail.com")
        .subject("Hello from Gmail via Nodemailer")
        .html(
            `
            <h1>Hello from Gmail!</h1>
            <p>This email was sent using Nodemailer with Gmail.</p>
            <p>Make sure to use an <strong>App Password</strong> instead of your regular Gmail password.</p>
        `,
        )
        .text("Hello from Gmail!\n\nThis email was sent using Nodemailer with Gmail.")
        .send();

    if (result.success) {
        console.log("✅ Email sent successfully via Gmail!");
        console.log("Message ID:", result.data?.messageId);
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
