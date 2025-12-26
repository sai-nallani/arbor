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
            "content": "what is hott in 20 words?"
        },
        {
            "role": "assistant",
            "content": "**Homotopy Type Theory (HoTT)** is a modern mathematical foundation unifying logic, computation, and topology, where types behave like spaces and equality like paths."
        },
        {
            "role": "system",
            "content": "[End of context from linked conversations. The following is the current conversation.]"
        },
        {
            "role": "user",
            "content": "i'm confused"
        },
        {
            "role": "assistant",
            "content": "No problem! Let me break it down simply:\n\n**HoTT (Homotopy Type Theory)** is a new way of doing math on computers where:\n\n- **Types** = collections of things (like \"numbers\" or \"shapes\")\n- **Equality** = paths connecting things (not just \"same or different\")\n- It connects **logic, programming, and geometry** in one framework\n\nThink of it as: instead of just saying two things \"are equal,\" HoTT asks \"**how** are they equal?\" and treats that \"how\" as a journey or path between them.\n\nDoes that help clarify it?"
        },
        {
            "content": "i think i understand"
        }
    ];

    console.log('Sending messages:', JSON.stringify(messages, null, 2));
    console.log('\n--- STREAMING RESPONSE ---\n');

    // Test single case
    console.log(`\n\n------------------------------------------------------------`);
    console.log(`TESTING WITHOUT IDs`);
    console.log(`------------------------------------------------------------`);

    try {
        const stream = await runner.run({
            messages: messages as any,
            model: ['anthropic/claude-sonnet-4-5-20250929', 'openai/gpt-4.1'],
            stream: true,
        });

        let fullContent = '';
        process.stdout.write('Response: ');
        for await (const chunk of stream as any) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }

        console.log(`\n\nCOMPLETE. Length: ${fullContent.length}`);
        if (fullContent.length === 0) {
            console.log(`⚠️  FAILED (Empty Response)`);
        } else {
            console.log(`✅  SUCCESS`);
        }
    } catch (error) {
        console.error(`ERROR:`, error);
    }
}

main();
