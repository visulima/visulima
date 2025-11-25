/**
 * Example: Using Nodemailer Provider with Sendmail Transport
 *
 * This example demonstrates how to use the nodemailer provider
 * with the sendmail transport (uses system sendmail command).
 */

import { createMail } from "@visulima/email";
import { nodemailerProvider } from "@visulima/email/providers/nodemailer";

const main = async () => {
    // Create nodemailer provider with sendmail transport
    const provider = nodemailerProvider({
        transport: {
            sendmail: true, // Use sendmail transport
            newline: "unix", // Use Unix newlines
            path: process.env.SENDMAIL_PATH || "/usr/sbin/sendmail", // Path to sendmail binary
        },
        defaultFrom: {
            email: process.env.FROM_EMAIL || "sender@example.com",
            name: "System Sender",
        },
    });

    // Create mail instance
    const mail = createMail(provider);

    // Initialize the provider
    await mail.initialize();

    // Send email using message builder
    const result = await mail
        .message()
        .to("recipient@example.com")
        .from("sender@example.com")
        .subject("Hello from Sendmail")
        .html("<h1>Hello World</h1><p>This email was sent using the system sendmail command.</p>")
        .text("Hello World\n\nThis email was sent using the system sendmail command.")
        .send();

    if (result.success) {
        console.log("✅ Email sent successfully via sendmail!");
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

