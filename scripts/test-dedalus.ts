/**
 * Dedalus CLI test script to reproduce the empty response issue
 * 
 * Run with: npx tsx scripts/test-dedalus.ts
 */

import Dedalus, { DedalusRunner } from 'dedalus-labs';

const client = new Dedalus({
    apiKey: process.env.DEDALUS_API_KEY,
});
const runner = new DedalusRunner(client);

async function testNormalConversation() {
    // console.log('\n========== TEST 1: Normal Conversation ==========\n');

    const messages = [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there! How can I help?' },
        { role: 'user', content: 'What is 2+2?' }
    ];

    // console.log('Messages:', JSON.stringify(messages, null, 2));

    try {
        const stream = await runner.run({
            messages: messages as any,
            model: 'anthropic/claude-opus-4-5',
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
        // console.log('\n\nResponse length:', fullContent.length);
        // console.log('SUCCESS: Got valid response');
    } catch (error) {
        console.error('ERROR:', error);
    }
}

async function testConsecutiveUserMessages() {
    // console.log('\n========== TEST 2: Two Consecutive User Messages (BUG) ==========\n');

    // This simulates what's happening in the app - two user messages in a row
    const messages = [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: 'how many steps?' },
        { role: 'assistant', content: '127 steps — that\'s how many the lighthouse keeper Marcus climbed each evening in the story.' },
        { role: 'user', content: 'huh? what light house?' },
        { role: 'assistant', content: 'The lighthouse from the short story I just told you!' },
        { role: 'user', content: 'i\'m not sure of any short story...' },
        // MISSING ASSISTANT MESSAGE HERE - simulating the bug
        { role: 'user', content: 'why?' }  // Two user messages in a row!
    ];

    // console.log('Messages (notice two consecutive user messages at the end):');
    messages.forEach((m, i) => // console.log(`  [${i}] ${m.role}: ${m.content.substring(0, 50)}...`));

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
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }

        // console.log('\n\nChunks received:', chunkCount);
        // console.log('Response length:', fullContent.length);

        if (fullContent.trim() === '' || fullContent.trim() === '...') {
            // console.log('⚠️ BUG REPRODUCED: Empty or invalid response!');
        } else {
            // console.log('Response was valid (bug may be intermittent)');
        }
    } catch (error) {
        console.error('ERROR:', error);
    }
    }

async function testWithContext() {
            // console.log('\n========== TEST 3: Context Link Injection Pattern ==========\n');

            // Simulating context injection with system message separator
            const messages = [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                // Context from linked block
                { role: 'user', content: 'Tell me a short story' },
                { role: 'assistant', content: 'Once upon a time, there was a lighthouse keeper named Marcus who climbed 127 steps every night...' },
                // System separator
                { role: 'system', content: '[End of context from linked conversations. The following is the current conversation.]' },
                // Current conversation
                { role: 'user', content: 'how many steps?' },
            ];

            // console.log('Messages with context injection:');
            messages.forEach((m, i) => // console.log(`  [${i}] ${m.role}: ${m.content.substring(0, 60)}...`));

    try {
                const stream = await runner.run({
                    messages: messages as any,
                    model: 'anthropic/claude-opus-4-5',
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
                // console.log('\n\nResponse length:', fullContent.length);
                // console.log(fullContent.length > 0 ? 'SUCCESS' : '⚠️ EMPTY RESPONSE');
            } catch (error) {
                console.error('ERROR:', error);
            }
            }

async function main() {
                    // console.log('='.repeat(60));
                    // console.log('DEDALUS EMPTY RESPONSE REPRODUCTION TEST');
                    // console.log('='.repeat(60));

                    if (!process.env.DEDALUS_API_KEY) {
                        console.error('ERROR: DEDALUS_API_KEY environment variable not set');
                        // console.log('Run with: DEDALUS_API_KEY=your_key npx tsx scripts/test-dedalus.ts');
                        process.exit(1);
                    }

                    await testNormalConversation();
                    await testConsecutiveUserMessages();
                    await testWithContext();

                    // console.log('\n' + '='.repeat(60));
                    // console.log('TESTS COMPLETE');
                    // console.log('='.repeat(60));
                }

main().catch(console.error);
