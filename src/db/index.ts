import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string from Supabase
const connectionString = process.env.DATABASE_URL;

// Validate connection string
if (!connectionString) {
    throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please add your Supabase connection string to .env file.'
    );
}

if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error(
        'DATABASE_URL must start with postgresql:// or postgres://. ' +
        'Current value appears to be malformed.'
    );
}

// Create postgres connection
const client = postgres(connectionString, {
    prepare: false, // Required for Supabase connection pooling
});

// Create drizzle database instance with schema
export const db = drizzle(client, { schema });

