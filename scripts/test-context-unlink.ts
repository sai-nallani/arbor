/**
 * Dedalus CLI test - Exact reproduction of context unlink scenario
 * 
 * Run with: npx tsx scripts/test-context-unlink.ts
 */

import Dedalus, { DedalusRunner } from 'dedalus-labs';

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

const SYSTEM_PROMPT = `You are a helpful AI assistant. You must use LaTeX formatting for all mathematical expressions. IMPORTANT: You MUST use dollar signs ($) for inline math (e.g., $E=mc^2$) and double dollar signs ($$) for block math. Do NOT use \\( ... \\) or \\[ ... \\] delimiters. You must strictly follow Markdown formatting rules for all output. Add appropriate spacing and paragraphing when necessary. Make it readable for the user.`;

async function testContextUnlinkScenario() {
    console.log('\n========== Context Unlink Scenario ==========\n');

    // Exact messages from the failing request [CHAT oei7va]
    // The AI previously saw context from a linked block about stars/calculations
    // Now the context is gone but the AI's previous response references it
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'could you explain that calculation' },
        {
            role: 'assistant', content: `# Explaining the Calculation

Certainly! Let me break down that astronomical calculation from the story about calculating the distance to stars using parallax.

## The Parallax Method

When we observe a nearby star from Earth at two different points in our orbit (6 months apart), the star appears to shift position against the background of more distant stars...` },
        { role: 'user', content: "i'm confused. what stars are you talking about?" },
    ];

    console.log('Messages:');
    messages.forEach((m, i) => {
        const preview = m.content.substring(0, 80).replace(/\n/g, '\\n');
        console.log(`  [${i}] ${m.role}: ${preview}...`);
    });
    console.log();

    // Test with Claude
    console.log('Testing with anthropic/claude-opus-4-5...');
    try {
        const stream = await runner.run({
            messages: messages as any,
            model: 'anthropic/claude-opus-4-5',
            stream: true,
        });

        let fullContent = '';
        let chunkCount = 0;
        for await (const chunk of stream as any) {
            chunkCount++;
            if (chunkCount <= 3) {
                console.log(`  Chunk ${chunkCount}:`, JSON.stringify(chunk).substring(0, 200));
            }
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) fullContent += content;
        }

        console.log(`\n  Chunks: ${chunkCount}, Content length: ${fullContent.length}`);
        if (fullContent.length > 0) {
            console.log('  Response:', fullContent.substring(0, 200) + '...');
            console.log('  ✓ Claude SUCCESS');
        } else {
            console.log('  ⚠️ Claude EMPTY RESPONSE');
        }
    } catch (error) {
        console.error('  Error:', error);
    }

    // Test with GPT
    console.log('\nTesting with openai/gpt-4.1...');
    try {
        const stream = await runner.run({
            messages: messages as any,
            model: 'openai/gpt-4.1',
            stream: true,
        });

        let fullContent = '';
        let chunkCount = 0;
        for await (const chunk of stream as any) {
            chunkCount++;
            if (chunkCount <= 3) {
                console.log(`  Chunk ${chunkCount}:`, JSON.stringify(chunk).substring(0, 200));
            }
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) fullContent += content;
        }

        console.log(`\n  Chunks: ${chunkCount}, Content length: ${fullContent.length}`);
        if (fullContent.length > 0) {
            console.log('  Response:', fullContent.substring(0, 200) + '...');
            console.log('  ✓ GPT SUCCESS');
        } else {
            console.log('  ⚠️ GPT EMPTY RESPONSE');
        }
    } catch (error) {
        console.error('  Error:', error);
    }
}

async function testFreshConversation() {
    console.log('\n========== Fresh Conversation (Control) ==========\n');

    const messages = [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: 'What is 2+2?' },
    ];

    console.log('Testing with anthropic/claude-opus-4-5...');
    try {
        const stream = await runner.run({
            messages: messages as any,
            model: 'anthropic/claude-opus-4-5',
            stream: true,
        });

        let fullContent = '';
        for await (const chunk of stream as any) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) fullContent += content;
        }

        console.log(`  Response: ${fullContent}`);
        console.log(fullContent.length > 0 ? '  ✓ Claude SUCCESS' : '  ⚠️ Claude EMPTY');
    } catch (error) {
        console.error('  Error:', error);
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('DEDALUS CONTEXT UNLINK REPRODUCTION TEST');
    console.log('='.repeat(60));

    if (!process.env.DEDALUS_API_KEY) {
        console.error('ERROR: DEDALUS_API_KEY not set');
        console.log('Run with: source .env && npx tsx scripts/test-context-unlink.ts');
        process.exit(1);
    }

    // First verify API is working
    await testFreshConversation();

    // Then test the actual scenario
    await testContextUnlinkScenario();

    console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
