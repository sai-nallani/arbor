/**
 * Dedalus CLI test - Exact reproduction of the failing conversation
 * 
 * Run with: npx tsx scripts/test-exact-conversation.ts
 */

import Dedalus, { DedalusRunner } from 'dedalus-labs';

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

async function testExactConversation(model: string) {
    console.log(`\n========== Testing with ${model} ==========\n`);

    // Exact messages from the failing request
    const messages = [
        { role: 'system', content: 'You are a helpful AI assistant. You must use LaTeX formatting for all mathematical expressions. IMPORTANT: You MUST use dollar signs ($) for inline math (e.g., $E=mc^2$) and double dollar signs ($$) for block math. Do NOT use \\( ... \\) or \\[ ... \\] delimiters. You must strictly follow Markdown formatting rules for all output. Add appropriate spacing and paragraphing when necessary. Make it readable for the user.' },
        { role: 'user', content: 'how many steps?' },
        { role: 'assistant', content: "127 steps — that's how many the lighthouse keeper Marcus climbed each evening in the story." },
        { role: 'user', content: 'huh? what light house?' },
        { role: 'assistant', content: 'The lighthouse from the short story I just told you! You asked me to tell you a short story, so I wrote one.' },
        { role: 'user', content: "i'm not sure of any short story..." },
        { role: 'assistant', content: 'I apologize, but I was unable to respond to that. Could you please try again or rephrase your question?' },
        { role: 'user', content: 'why?' },
        { role: 'assistant', content: 'I apologize, but I was unable to respond to that. Could you please try again or rephrase your question?' },
        { role: 'user', content: 'hmm, something is wrong.' },
        { role: 'assistant', content: 'I apologize, but I was unable to respond to that. Could you please try again or rephrase your question?' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'I apologize, but I was unable to respond to that. Could you please try again or rephrase your question?' },
        { role: 'user', content: 'why is it not working' },
    ];

    console.log('Messages:', messages.length, 'total');

    try {
        const stream = await runner.run({
            messages: messages as any,
            model,
            stream: true,
        });

        let fullContent = '';
        let chunkCount = 0;
        for await (const chunk of stream as any) {
            chunkCount++;
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }

        console.log('\n');
        console.log('Chunks:', chunkCount);
        console.log('Response length:', fullContent.length);

        if (fullContent.trim() === '' || fullContent.trim() === '...') {
            console.log('⚠️ EMPTY RESPONSE with model:', model);
            return false;
        } else {
            console.log('✓ Got valid response');
            return true;
        }
    } catch (error) {
        console.error('ERROR:', error);
        return false;
    }
}

async function testFreshConversation(model: string) {
    console.log(`\n========== FRESH Conversation with ${model} ==========\n`);

    const messages = [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: 'Hello! What is 2+2?' },
    ];

    try {
        const stream = await runner.run({
            messages: messages as any,
            model,
            stream: true,
        });

        let fullContent = '';
        for await (const chunk of stream as any) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }

        console.log('\n');
        console.log('Response length:', fullContent.length);
        return fullContent.length > 0;
    } catch (error) {
        console.error('ERROR:', error);
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('DEDALUS EXACT CONVERSATION REPRODUCTION');
    console.log('='.repeat(60));

    if (!process.env.DEDALUS_API_KEY) {
        console.error('ERROR: DEDALUS_API_KEY not set');
        process.exit(1);
    }

    // Test fresh conversations first
    await testFreshConversation('anthropic/claude-opus-4-5');
    await testFreshConversation('openai/gpt-4.1');

    // Test the exact failing conversation with different models
    const claudeResult = await testExactConversation('anthropic/claude-opus-4-5');
    const gptResult = await testExactConversation('openai/gpt-4.1');

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS:');
    console.log('  Claude Opus:', claudeResult ? '✓ Works' : '✗ FAILS');
    console.log('  GPT-4.1:', gptResult ? '✓ Works' : '✗ FAILS');
    console.log('='.repeat(60));
}

main().catch(console.error);
