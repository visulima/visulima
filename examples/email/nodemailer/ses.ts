/**
 * Example: Using Nodemailer Provider with AWS SES Transport
 *
 * This example demonstrates how to use the nodemailer provider
 * with AWS SES transport. Requires AWS SDK v2.
 */

import { createMail } from "@visulima/email";
import { nodemailerProvider } from "@visulima/email/providers/nodemailer";

// Note: This example requires aws-sdk v2
// Install with: npm install aws-sdk
// For AWS SDK v3, use the SMTP transport with SES SMTP credentials instead

const main = async () => {
    // Dynamically import aws-sdk (it's an optional dependency)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aws = await import("aws-sdk");

    // Create AWS SES instance
    // Make sure to set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables
    const ses = new aws.SES({
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // Create nodemailer provider with SES transport
    const provider = nodemailerProvider({
        transport: {
            SES: { ses, aws },
        },
        defaultFrom: {
            email: process.env.SES_FROM_EMAIL || "sender@example.com",
            name: "AWS SES Sender",
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
        .subject("Hello from AWS SES via Nodemailer")
        .html("<h1>Hello World</h1><p>This email was sent using Nodemailer with AWS SES transport.</p>")
        .text("Hello World\n\nThis email was sent using Nodemailer with AWS SES transport.")
        .send();

    if (result.success) {
        console.log("✅ Email sent successfully via AWS SES!");
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
    console.error("\nNote: This example requires aws-sdk v2. Install with: npm install aws-sdk");
    process.exit(1);
});

