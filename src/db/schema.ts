import { pgTable, text, timestamp, doublePrecision, uuid, uniqueIndex, boolean, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// TABLES
// ============================================

// Users table - stores Clerk user info
export const users = pgTable('users', {
    id: text('id').primaryKey(), // Clerk user ID
    email: text('email').notNull().unique(),
    name: text('name'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Boards - workspaces/canvases that contain chat blocks and files
export const boards = pgTable('boards', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').default('Untitled Board').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Chat blocks - conversation nodes on the canvas
export const chatBlocks = pgTable('chat_blocks', {
    id: uuid('id').defaultRandom().primaryKey(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    title: text('title').default('New Chat').notNull(),
    model: text('model').default('openai/gpt-5.1').notNull(),
    positionX: doublePrecision('position_x').notNull(),
    positionY: doublePrecision('position_y').notNull(),
    width: doublePrecision('width').default(800),
    height: doublePrecision('height').default(800),
    isExpanded: boolean('is_expanded').default(false),
    hasImage: boolean('has_image').default(false), // True if chat contains images (locks to OpenAI models)
    parentId: uuid('parent_id').references((): AnyPgColumn => chatBlocks.id, { onDelete: 'set null' }), // Self-reference for branching
    branchContext: jsonb('branch_context'), // Array of message IDs from parent chain
    branchSourceText: text('branch_source_text'), // The highlighted text that spawned this branch
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Messages - individual chat messages within a block
export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    chatBlockId: uuid('chat_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    hiddenContext: text('hidden_context'), // Context invisible to user but seen by AI (e.g. "User highlighted: ...")
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// File nodes - uploaded files on the canvas
export const fileNodes = pgTable('file_nodes', {
    id: uuid('id').defaultRandom().primaryKey(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    url: text('url').notNull(),
    extractedContent: text('extracted_content'), // Text extracted from file for context
    positionX: doublePrecision('position_x').notNull(),
    positionY: doublePrecision('position_y').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// File links - junction table for many-to-many file-to-chat linking
export const fileLinks = pgTable('file_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    chatBlockId: uuid('chat_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    fileNodeId: uuid('file_node_id').notNull().references(() => fileNodes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    // Prevent duplicate links between same file and chat
    uniqueIndex('file_links_unique_idx').on(table.chatBlockId, table.fileNodeId),
]);

// Context links - directed edges for context sharing between chat blocks
// If A → B exists, B includes A's message history as context
export const contextLinks = pgTable('context_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceBlockId: uuid('source_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    targetBlockId: uuid('target_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    sourceHandle: text('source_handle').default('right'), // The handle on the source block (e.g., 'right', 'bottom', 'left', 'top')
    targetHandle: text('target_handle').default('left'),   // The handle on the target block
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    // Prevent duplicate links between same source and target
    uniqueIndex('context_links_unique_idx').on(table.sourceBlockId, table.targetBlockId),
]);

// Image context links - directed edges for image context sharing to chat blocks
// If image A → chatBlock B exists, B includes A's image as context in its messages
export const imageContextLinks = pgTable('image_context_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    imageNodeId: uuid('image_node_id').notNull().references(() => fileNodes.id, { onDelete: 'cascade' }),
    targetBlockId: uuid('target_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    // Prevent duplicate links between same image and chat block
    uniqueIndex('image_context_links_unique_idx').on(table.imageNodeId, table.targetBlockId),
]);

// Sticky Notes - simple text nodes on the canvas
export const stickyNotes = pgTable('sticky_notes', {
    id: uuid('id').defaultRandom().primaryKey(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    content: text('content').default('').notNull(),
    color: text('color').default('yellow').notNull(), // 'yellow', 'blue', 'green', 'pink'
    positionX: doublePrecision('position_x').notNull(),
    positionY: doublePrecision('position_y').notNull(),
    width: doublePrecision('width').default(200),
    height: doublePrecision('height').default(200),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sticky Note context links - directed edges for text context sharing
export const stickyContextLinks = pgTable('sticky_context_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    stickyNoteId: uuid('sticky_note_id').notNull().references(() => stickyNotes.id, { onDelete: 'cascade' }),
    targetBlockId: uuid('target_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('sticky_context_links_unique_idx').on(table.stickyNoteId, table.targetBlockId),
]);



// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
    boards: many(boards),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
    user: one(users, { fields: [boards.userId], references: [users.id] }),
    chatBlocks: many(chatBlocks),
    fileNodes: many(fileNodes),
    stickyNotes: many(stickyNotes),
}));



export const fileNodesRelations = relations(fileNodes, ({ one, many }) => ({
    board: one(boards, { fields: [fileNodes.boardId], references: [boards.id] }),
    fileLinks: many(fileLinks),
}));

export const fileLinksRelations = relations(fileLinks, ({ one }) => ({
    chatBlock: one(chatBlocks, { fields: [fileLinks.chatBlockId], references: [chatBlocks.id] }),
    fileNode: one(fileNodes, { fields: [fileLinks.fileNodeId], references: [fileNodes.id] }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;

export type ChatBlock = typeof chatBlocks.$inferSelect;
export type NewChatBlock = typeof chatBlocks.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type FileNode = typeof fileNodes.$inferSelect;
export type NewFileNode = typeof fileNodes.$inferInsert;

export type NewFileLink = typeof fileLinks.$inferInsert;

// Message links - for branching references (footnotes)
export const messageLinks = pgTable('message_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceMessageId: uuid('source_message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    targetBlockId: uuid('target_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
    quoteStart: doublePrecision('quote_start').notNull(), // Using double for safe integer storage if needed, but int is fine
    quoteEnd: doublePrecision('quote_end').notNull(),
    quoteText: text('quote_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messageLinksRelations = relations(messageLinks, ({ one }) => ({
    sourceMessage: one(messages, { fields: [messageLinks.sourceMessageId], references: [messages.id] }),
    targetBlock: one(chatBlocks, { fields: [messageLinks.targetBlockId], references: [chatBlocks.id] }),
}));

// AI Error Logs - capture failures for debugging
export const aiErrorLogs = pgTable('ai_error_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id'), // Nullable if anon
    model: text('model'),
    inputMessages: jsonb('input_messages'),
    errorType: text('error_type'), // 'null_response', 'empty_content', 'provider_error'
    rawOutput: text('raw_output'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Update existing relations
export const messagesRelations = relations(messages, ({ one, many }) => ({
    chatBlock: one(chatBlocks, { fields: [messages.chatBlockId], references: [chatBlocks.id] }),
    outgoingLinks: many(messageLinks, { relationName: 'sourceMessage' }),
}));

export const chatBlocksRelations = relations(chatBlocks, ({ one, many }) => ({
    board: one(boards, { fields: [chatBlocks.boardId], references: [boards.id] }),
    parent: one(chatBlocks, {
        fields: [chatBlocks.parentId],
        references: [chatBlocks.id],
        relationName: 'branches'
    }),
    children: many(chatBlocks, { relationName: 'branches' }),
    messages: many(messages),
    fileLinks: many(fileLinks),
    incomingLinks: many(messageLinks, { relationName: 'targetBlock' }),
    // Context links for context sharing between blocks
    contextSources: many(contextLinks, { relationName: 'contextTarget' }), // Blocks providing context TO this block
    contextTargets: many(contextLinks, { relationName: 'contextSource' }), // Blocks receiving context FROM this block
    // Sticky Notes Links
    stickyNoteContexts: many(stickyContextLinks),
}));

export const contextLinksRelations = relations(contextLinks, ({ one }) => ({
    sourceBlock: one(chatBlocks, { fields: [contextLinks.sourceBlockId], references: [chatBlocks.id], relationName: 'contextSource' }),
    targetBlock: one(chatBlocks, { fields: [contextLinks.targetBlockId], references: [chatBlocks.id], relationName: 'contextTarget' }),
}));

export const stickyNotesRelations = relations(stickyNotes, ({ one, many }) => ({
    board: one(boards, { fields: [stickyNotes.boardId], references: [boards.id] }),
    contextLinks: many(stickyContextLinks),
}));

export const stickyContextLinksRelations = relations(stickyContextLinks, ({ one }) => ({
    stickyNote: one(stickyNotes, { fields: [stickyContextLinks.stickyNoteId], references: [stickyNotes.id] }),
    targetBlock: one(chatBlocks, { fields: [stickyContextLinks.targetBlockId], references: [chatBlocks.id] }),
}));

export type MessageLink = typeof messageLinks.$inferSelect;
export type NewMessageLink = typeof messageLinks.$inferInsert;

export type ContextLink = typeof contextLinks.$inferSelect;
export type NewContextLink = typeof contextLinks.$inferInsert;

export type StickyNote = typeof stickyNotes.$inferSelect;
export type NewStickyNote = typeof stickyNotes.$inferInsert;

export type StickyContextLink = typeof stickyContextLinks.$inferSelect;
export type NewStickyContextLink = typeof stickyContextLinks.$inferInsert;

// Daily Token Usage - for rate limiting
export const dailyTokenUsage = pgTable('daily_token_usage', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id'), // Nullable if anon, but ideally linked to user
    date: text('date').notNull(), // Format: YYYY-MM-DD
    tokenCount: doublePrecision('token_count').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('daily_token_usage_user_date_idx').on(table.userId, table.date),
]);

export type DailyTokenUsage = typeof dailyTokenUsage.$inferSelect;
export type NewDailyTokenUsage = typeof dailyTokenUsage.$inferInsert;
