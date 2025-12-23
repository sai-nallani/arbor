/**
 * Dedalus Labs AI Provider
 * 
 * Implementation of AIProvider using the dedalus-labs SDK.
 */

import Dedalus, { DedalusRunner } from 'dedalus-labs';
import type { AIProvider, AICompletionOptions, AIStreamChunk } from '../types';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export class DedalusProvider implements AIProvider {
    readonly name = 'dedalus';
    private client: Dedalus;
    private runner: DedalusRunner;

    constructor() {
        this.client = new Dedalus({
            apiKey: process.env.DEDALUS_API_KEY,
        });
        this.runner = new DedalusRunner(this.client);
    }

    async chat(options: AICompletionOptions): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: options.model || DEFAULT_MODEL,
            messages: options.messages,
            stream: false,
        });

        return response.choices[0]?.message?.content || '';
    }

    async streamChat(options: AICompletionOptions): Promise<AsyncIterable<AIStreamChunk>> {
        const stream = await this.runner.run({
            model: options.model || DEFAULT_MODEL,
            messages: options.messages,
            stream: true,
        });

        // Transform the Dedalus stream into our AIStreamChunk format
        const self = this;
        return {
            async *[Symbol.asyncIterator]() {
                for await (const chunk of stream) {
                    if (chunk.choices?.[0]?.delta?.content) {
                        yield {
                            id: chunk.id || '',
                            content: chunk.choices[0].delta.content,
                            done: false,
                        };
                    }
                }
                yield { id: '', content: '', done: true };
            },
        };
    }

    /**
     * Get the underlying runner for use with dedalus-react
     */
    getRunner(): DedalusRunner {
        return this.runner;
    }

    /**
     * Get the underlying client
     */
    getClient(): Dedalus {
        return this.client;
    }
}

// Singleton instance
let instance: DedalusProvider | null = null;

export function getDedalusProvider(): DedalusProvider {
    if (!instance) {
        instance = new DedalusProvider();
    }
    return instance;
}
