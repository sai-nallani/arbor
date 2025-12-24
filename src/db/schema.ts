import { pgTable, text, timestamp, doublePrecision, uuid, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
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
    model: text('model').default('openai/gpt-5').notNull(),
    positionX: doublePrecision('position_x').notNull(),
    positionY: doublePrecision('position_y').notNull(),
    isExpanded: boolean('is_expanded').default(false),
    parentId: uuid('parent_id').references(() => chatBlocks.id, { onDelete: 'set null' }), // Self-reference for branching
    branchContext: text('branch_context'), // Compressed context from parent chain
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
}));

export type MessageLink = typeof messageLinks.$inferSelect;
export type NewMessageLink = typeof messageLinks.$inferInsert;
