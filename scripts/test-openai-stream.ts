
import OpenAI from "openai";
import * as dotenv from 'dotenv';
dotenv.config();

// Logic from route.ts
async function testStream() {
    console.log("Starting OpenAI Stream Test...");
    if (!process.env.OPENAI_API_KEY) {
        console.error("Missing OPENAI_API_KEY");
        return;
    }

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        console.log("Sending request to OpenAI...");
        // Using a standard model for testing to minimize variables, unless user specifically wants to test 5.1
        // But let's test the EXACT model string we use in the app
        const model = 'gpt-5.1';

        // Note: Check if 'responses' exists on client. older SDKs might not have it.
        // If this throws, we know SDK is too old.
        if (!client.responses) {
            console.error("client.responses is undefined. SDK might be outdated.");
            // Fallback check standard chat
            // return;
        }

        // We'll try the exact call structure
        const response = await client.responses.create({
            model: model,
            input: [{ role: "user", content: "Hello, count to 3." }],
            stream: true,
        });

        console.log("Response received. Iterating events...");

        for await (const event of response) {
            console.log("\n--- Raw Event ---");
            console.log(JSON.stringify(event, null, 2));

            let deltaContent = '';

            // Logic from route.ts
            // NEW CORRECT LOGIC
            // Case C: Real Responses API Delta
            if ((event as any).type === 'response.output_item.delta') {
                const delta = (event as any).delta;
                if (delta && delta.type === 'output_text_delta' && delta.text) {
                    deltaContent = delta.text;
                    console.log(`-> MATCHED DELTA: "${deltaContent.replace(/\n/g, '\\n')}"`);
                }
            } else if ((event as any).choices?.[0]?.delta?.content) {
                deltaContent = (event as any).choices[0].delta.content;
                console.log("-> Matched Standard Chunk pattern");
            }
            else if (Array.isArray((event as any).output)) {
                // ... (Keep existing logic if needed but primarily it's completed events)
            } else {
                // console.log("-> NO PATTERN MATCHED");
            }

            if (deltaContent) {
                console.log(`[STREAM OUTPUT] ${deltaContent}`);
            }
        }
        console.log("\nStream finished.");

    } catch (error) {
        console.error("Error during test:", error);
    }
}

testStream();
