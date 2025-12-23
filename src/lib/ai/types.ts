/**
 * AI Provider Types
 * 
 * Modular abstraction layer for AI providers.
 * Allows easy switching between Dedalus, OpenAI, Anthropic, etc.
 */

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIStreamChunk {
    id: string;
    content: string;
    done: boolean;
}

export interface AICompletionOptions {
    messages: AIMessage[];
    model?: string;
    stream?: boolean;
    maxTokens?: number;
}

export interface AIProvider {
    readonly name: string;

    /**
     * Create a chat completion (non-streaming)
     */
    chat(options: AICompletionOptions): Promise<string>;

    /**
     * Create a streaming chat completion
     * Returns an async iterable of chunks
     */
    streamChat(options: AICompletionOptions): Promise<AsyncIterable<AIStreamChunk>>;
}

export type AIProviderName = 'dedalus' | 'openai' | 'anthropic';
