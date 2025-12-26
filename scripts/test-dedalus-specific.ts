/**
 * Dedalus CLI test script for specific user request payload
 * 
 * Run with: npx tsx scripts/test-dedalus-specific.ts
 */

import Dedalus, { DedalusRunner } from 'dedalus-labs';
import fs from 'fs';
import path from 'path';

// Load .env file manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    console.log('Loading .env from:', envPath);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1'); // Remove quotes if present
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

async function main() {
    console.log('='.repeat(60));
    console.log('TESTING DEDALUS OPUS 4.5 WITH SPECIFIC PAYLOAD');
    console.log('='.repeat(60));

    if (!process.env.DEDALUS_API_KEY) {
        console.error('ERROR: DEDALUS_API_KEY environment variable not set');
        process.exit(1);
    }

    const messages = [
        {
            "role": "system",
            "content": "You are a helpful AI assistant. You must use LaTeX formatting for all mathematical expressions. IMPORTANT: You MUST use dollar signs ($) for inline math (e.g., $E=mc^2$) and double dollar signs ($$) for block math. Do NOT use \\( ... \\) or \\[ ... \\] delimiters. You must strictly follow Markdown formatting rules for all output. Add appropriate spacing and paragraphing when necessary. Make it readable for the user."
        },
        {
            "role": "user",
            "content": "explain HOTT in 20 words"
        },
        {
            "role": "assistant",
            "content": "**Homotopy Type Theory (HoTT):** A foundation for mathematics merging type theory with homotopy theory, where types are spaces and equality is path equivalence."
        },
        {
            "role": "system",
            "content": "[End of context from linked conversations. The following is the current conversation.]"
        },
        {
            "role": "user",
            "content": "i'm confused._"
        }
    ];

    console.log('Sending messages:', JSON.stringify(messages, null, 2));
    console.log('\n--- STREAMING RESPONSE ---\n');

    try {
        // If this fails, it's the array syntax
        const stream = await runner.run({
            messages: messages as any,
            model: ['anthropic/claude-opus-4-5', 'openai/gpt-4.1'], // Test array syntax
            stream: true
        });

        let fullContent = '';
        for await (const chunk of stream as any) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }

        console.log('\n\n' + '='.repeat(60));
        console.log('RESPONSE COMPLETE');
    } catch (error) {
        console.error('ERROR:', error);
    }
}

main().catch(console.error);
