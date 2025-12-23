/**
 * AI Provider Factory
 * 
 * Central module for getting AI providers.
 * Add new providers here as they're implemented.
 */

import type { AIProvider, AIProviderName } from './types';
import { DedalusProvider, getDedalusProvider } from './providers/dedalus';

export * from './types';
export { DedalusProvider } from './providers/dedalus';

// Default provider
const DEFAULT_PROVIDER: AIProviderName = 'dedalus';

/**
 * Get an AI provider by name
 */
export function getAIProvider(name: AIProviderName = DEFAULT_PROVIDER): AIProvider {
    switch (name) {
        case 'dedalus':
            return getDedalusProvider();
        case 'openai':
            throw new Error('OpenAI provider not yet implemented');
        case 'anthropic':
            throw new Error('Anthropic provider not yet implemented');
        default:
            throw new Error(`Unknown AI provider: ${name}`);
    }
}

/**
 * Get the Dedalus provider specifically (for dedalus-react integration)
 */
export { getDedalusProvider };
