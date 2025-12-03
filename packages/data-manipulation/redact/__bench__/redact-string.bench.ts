import { redact, standardRules, stringAnonymize } from "@visulima/redact/dist/dist";
import { bench, describe } from "vitest";

const simpleInput = "John Doe will be 30 on 2024-06-10.";

describe("redact short string", () => {
    bench("@visulima/redact", () => {
        const output = redact(simpleInput, standardRules);

        if (output === simpleInput) {
            throw new Error("Something did go wrong");
        }
    });

    bench("@visulima/stringAnonymize", () => {
        const output = stringAnonymize(simpleInput, standardRules);

        if (output === simpleInput) {
            throw new Error("Something did go wrong");
        }
    });
});

const textInput = `My name is Jessica Thompson, and I was born on May 12, 1988, in a small town called Oakdale. I grew up with my parents and two siblings, an older brother named Daniel and a younger sister named Emily. We lived in a cozy two-story house with a white picket fence. In high school, I was actively involved in the drama club and played the lead role in our school's production of "Romeo and Juliet." After graduation, I pursued my passion for writing and earned a Bachelor's degree in English Literature from the University of Cambridge in 2010. Currently, I work as a freelance writer, specializing in content creation for various online platforms.
If you'd like to reach me, you can email me at johndoe1985@example.com or give me a call at +1 (555) 123-4567.
Please note that the credit card number provided, 4916 2899 5678 1234, is purely fictional and should not be used for any actual transactions or financial purposes.
In my free time, I enjoy hiking, painting, and playing the guitar. I'm also an avid traveler and have visited over 20 countries, each leaving a unique mark on my adventurous soul.
Please remember that all the information provided, including the credit card number, email address, and phone number, is entirely fictional and randomly generated. It does not represent any real individuals or their personal experiences.`;

describe("redact text string", () => {
    bench("@visulima/redact", () => {
        const output = redact(textInput, standardRules);

        if (output === textInput) {
            throw new Error("Something did go wrong");
        }
    });

    bench("@visulima/stringAnonymize", () => {
        const output = stringAnonymize(textInput, standardRules);

        if (output === textInput) {
            throw new Error("Something did go wrong");
        }
    });
});
