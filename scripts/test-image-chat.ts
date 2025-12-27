
import OpenAI from "openai";
import * as dotenv from 'dotenv';
dotenv.config();

async function testImageChat() {
    console.log("Starting OpenAI Image Chat Test...");
    if (!process.env.OPENAI_API_KEY) {
        console.error("Missing OPENAI_API_KEY");
        return;
    }

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const model = 'gpt-5.1';
        // Public image that OpenAI can definitely reach
        const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg";

        console.log(`Sending request to ${model} with image...`);

        const messages = [
            {
                role: "user",
                content: [
                    { type: "input_text", text: "What is this image?" },
                    { type: "input_image", image_url: imageUrl }
                ]
            }
        ];

        const response = await client.responses.create({
            model: model,
            input: messages as any[],
            stream: false, // Simple check first
        });

        console.log("Response received:");
        console.log(JSON.stringify(response, null, 2));

    } catch (error: any) {
        console.error("Error during test:", error);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
}

testImageChat();
