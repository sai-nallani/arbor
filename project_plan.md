# Arbor: Spatial Chat Interface

## Project Overview

Arbor is a spatial chat application that reimagines how we interact with AI conversations. Instead of the traditional linear chat interface, Arbor presents conversations on an infinite canvas where thoughts can branch, connect, and evolve organically—mirroring how we actually think and brainstorm.

The core insight is that linear chat interfaces create an artificial constraint: conversations don't happen in a single thread. When exploring complex topics, we naturally want to pursue tangents, compare alternatives, and maintain multiple lines of inquiry simultaneously. Arbor makes this possible by treating each conversation as a node in a spatial graph, where new branches can spawn from any point in the discussion.

## Core Concepts

### The Canvas
An infinite 2D workspace where all conversations live. Users navigate by panning and zooming, organizing their thoughts spatially. Position becomes meaningful—related topics cluster together, archived threads drift to the edges, active work stays front and center.

### Chat Blocks
Individual conversation threads rendered as draggable nodes on the canvas. Each block contains a complete chat history with the AI and can be repositioned freely. Blocks display a preview (title + recent message) in canvas view and expand to full conversation in focus mode.

### Branching
The signature interaction. Users can highlight any text in a conversation and spawn a new chat block that inherits the full context up to that point. This creates a parent-child relationship visualized by connection lines, enabling deep exploration without losing the original thread.

### Context Linking
Files and documents exist as standalone nodes on the canvas. Dragging a connection from a file to a chat block adds that file to the conversation's context. This makes context management explicit and visual rather than hidden behind upload buttons.

## Feature List

### Canvas System
- Infinite pan and zoom canvas with smooth inertia
- Dark theme workspace (#1a1a1a background)
- Subtle dot grid pattern indicating infinite space
- Minimap for navigation with viewport indicator
- Click minimap to jump to location
- Keyboard shortcuts: Space+drag to pan, scroll to zoom

### Chat Blocks
- Draggable, repositionable conversation nodes
- Compact preview mode showing title and last message snippet
- Visual connection lines showing parent-child relationships
- Timestamp display on each block
- Smooth animations for creation and deletion
- Auto-generated titles based on conversation content

### Focus Mode
- Double-click block to enter focused conversation view
- Smooth zoom animation to center and enlarge selected block
- Background canvas dims but remains visible for context
- Full chat interface with message input
- Press Escape or click outside to return to canvas view
- Maintains scroll position when returning to same block

### Branching System
- Text selection in any message reveals Branch button
- Branch creates child block with inherited context
- Animated connection line drawn from parent to child
- Child positioned automatically (offset right and down from parent)
- Context compression for long parent chains
- Visual indicator showing branch point in parent conversation

### File Nodes
- Drag and drop files onto canvas to create file nodes
- Pill-shaped nodes with file type icon and truncated name
- Color-coded borders by file type (blue for documents, green for images)
- Drag connection from file to chat block to link
- Dashed line with "linked" label for active connections
- "Drop to connect" indicator when dragging near valid target
- Multiple files can link to single chat block

### AI Integration
- Real-time streaming responses
- Context includes: current conversation + linked files + compressed parent chain
- Model selection (Claude, GPT-4, Gemini)
- Token usage indicator per block
- Retry failed messages
- Stop generation button

### User Experience
- Empty state with onboarding prompt and tagline
- New Chat button + spacebar shortcut to create block at cursor
- Undo/redo for canvas operations
- Block deletion with confirmation
- Search across all conversations
- Keyboard navigation between blocks

### Authentication & Data
- Google OAuth sign-in via Clerk
- User-scoped data isolation
- Real-time database sync with Supabase
- Optimistic UI updates with server confirmation
- Automatic save on all interactions

## Technical Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Authentication | Clerk (Google OAuth) |
| Database | Supabase (PostgreSQL) |
| ORM | Drizzle |
| Canvas | React Flow |
| State | Zustand (client) + React Query (server) |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| AI | Anthropic Claude API |
| File Storage | Supabase Storage |
| Deployment | Vercel |

### Project Structure
```
arbor/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (main)/
│   │   ├── canvas/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── chat/route.ts
│   │   ├── blocks/route.ts
│   │   ├── files/route.ts
│   │   └── webhooks/clerk/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx
│   │   ├── ChatBlockNode.tsx
│   │   ├── FileNode.tsx
│   │   ├── ConnectionLine.tsx
│   │   └── Minimap.tsx
│   ├── chat/
│   │   ├── FocusedChat.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   └── BranchButton.tsx
│   ├── ui/
│   │   └── (shared components)
│   └── providers/
│       └── Providers.tsx
├── db/
│   ├── schema.ts
│   ├── index.ts
│   └── migrations/
├── lib/
│   ├── supabase.ts
│   ├── ai.ts
│   └── utils.ts
├── stores/
│   └── canvasStore.ts
├── hooks/
│   ├── useBlocks.ts
│   ├── useFiles.ts
│   └── useCanvasSync.ts
└── types/
    └── index.ts
```

### Database Schema (Drizzle)
```typescript
// db/schema.ts
import { pgTable, text, timestamp, doublePrecision, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  name: text('name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatBlocks = pgTable('chat_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').default('New Chat').notNull(),
  positionX: doublePrecision('position_x').notNull(),
  positionY: doublePrecision('position_y').notNull(),
  parentId: uuid('parent_id'),
  branchContext: text('branch_context'),
  branchSourceText: text('branch_source_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatBlockId: uuid('chat_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fileNodes = pgTable('file_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  url: text('url').notNull(),
  extractedContent: text('extracted_content'),
  positionX: doublePrecision('position_x').notNull(),
  positionY: doublePrecision('position_y').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fileLinks = pgTable('file_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatBlockId: uuid('chat_block_id').notNull().references(() => chatBlocks.id, { onDelete: 'cascade' }),
  fileNodeId: uuid('file_node_id').notNull().references(() => fileNodes.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const chatBlocksRelations = relations(chatBlocks, ({ one, many }) => ({
  user: one(users, { fields: [chatBlocks.userId], references: [users.id] }),
  parent: one(chatBlocks, { fields: [chatBlocks.parentId], references: [chatBlocks.id], relationName: 'branches' }),
  children: many(chatBlocks, { relationName: 'branches' }),
  messages: many(messages),
  fileLinks: many(fileLinks),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chatBlock: one(chatBlocks, { fields: [messages.chatBlockId], references: [chatBlocks.id] }),
}));

export const fileNodesRelations = relations(fileNodes, ({ one, many }) => ({
  user: one(users, { fields: [fileNodes.userId], references: [users.id] }),
  fileLinks: many(fileLinks),
}));

export const fileLinksRelations = relations(fileLinks, ({ one }) => ({
  chatBlock: one(chatBlocks, { fields: [fileLinks.chatBlockId], references: [chatBlocks.id] }),
  fileNode: one(fileNodes, { fields: [fileLinks.fileNodeId], references: [fileNodes.id] }),
}));
```

### State Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Zustand Store  │    │         React Query             │ │
│  │  (UI State)     │    │       (Server State)            │ │
│  │                 │    │                                 │ │
│  │  - viewport     │    │  - useBlocks() → GET /api/blocks│ │
│  │  - focusedId    │    │  - useCreateBlock() → POST      │ │
│  │  - selectedIds  │    │  - useUpdateBlock() → PATCH     │ │
│  │  - isDragging   │    │  - useMessages() → GET          │ │
│  └─────────────────┘    │  - useSendMessage() → POST      │ │
│                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ /api/blocks │ │ /api/chat   │ │ /api/webhooks/clerk     ││
│  │             │ │ (streaming) │ │ (user sync)             ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase                                │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │     PostgreSQL      │    │         Storage             │ │
│  │  (via Drizzle ORM)  │    │     (File uploads)          │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Page Load**: Clerk validates session → React Query fetches user's blocks/files → Zustand initializes viewport
2. **Create Block**: Optimistic update to React Query cache → POST to API → Drizzle insert → Confirm or rollback
3. **Move Block**: Zustand updates position immediately → Debounced PATCH to API → Drizzle update
4. **Send Message**: Append user message optimistically → POST to /api/chat → Stream AI response chunks → Append to cache
5. **Branch**: Create child block with parentId → Copy compressed context → Draw edge in React Flow

## Implementation Phases

### Day 1: Infrastructure + Canvas Foundation

#### Morning: Project Setup & Auth (2-3 hours)
- [ ] Initialize Next.js 14 project with TypeScript and Tailwind
- [ ] Set up Clerk
  - Create Clerk application
  - Configure Google OAuth provider
  - Add Clerk provider and middleware
  - Create sign-in/sign-up pages
- [ ] Set up Supabase
  - Create Supabase project
  - Get connection string for Drizzle
  - Configure Supabase Storage bucket for files
- [ ] Set up Drizzle
  - Install drizzle-orm and drizzle-kit
  - Create schema file with all tables
  - Run initial migration
  - Create db connection utility
- [ ] Create Clerk webhook to sync users to database
- [ ] Deploy to Vercel (get CI/CD working early)

#### Afternoon: Canvas Foundation (3-4 hours)
- [ ] Install and configure React Flow
- [ ] Create Canvas component with pan/zoom
- [ ] Create ChatBlockNode custom node component
- [ ] Set up Zustand store for viewport state
- [ ] Set up React Query with initial useBlocks hook
- [ ] Create API route: GET /api/blocks
- [ ] Create API route: POST /api/blocks
- [ ] Test: Create blocks that persist to database
- [ ] Implement drag-to-reposition with debounced save
- [ ] Create API route: PATCH /api/blocks/[id]
- [ ] Verify deployment works with auth + database

**Day 1 Deliverable**: Authenticated app with canvas where you can create and drag chat blocks that persist to database.

### Day 2: Chat Functionality + Branching

#### Morning: Chat System (3-4 hours)
- [ ] Create FocusedChat component
- [ ] Implement focus mode transition (double-click → zoom)
- [ ] Add escape key to exit focus mode
- [ ] Create MessageList component
- [ ] Create MessageInput component
- [ ] Create API route: GET /api/blocks/[id]/messages
- [ ] Create API route: POST /api/chat (streaming)
  - Accept blockId and message content
  - Call Claude API with streaming
  - Save user message and assistant response to database
- [ ] Implement useMessages hook with React Query
- [ ] Implement useSendMessage mutation with optimistic updates
- [ ] Test: Full conversation flow with real AI responses

#### Afternoon: Branching System (3-4 hours)
- [ ] Add text selection detection in messages
- [ ] Create BranchButton tooltip component
- [ ] Implement branch creation logic
  - Calculate child position (offset from parent)
  - Compress parent context for branchContext field
  - Create new block with parentId reference
- [ ] Create API route: POST /api/blocks/[id]/branch
- [ ] Add connection edges to React Flow for parent-child
- [ ] Style edges (curved lines matching mockup)
- [ ] Implement context assembly for branched chats
  - Fetch parent chain
  - Decompress/combine contexts
  - Include in AI prompt
- [ ] Test: Create branch, verify context carries over

**Day 2 Deliverable**: Working chat with AI responses, branching from any message with full context inheritance.

### Day 3: Files, Polish & Demo Ready

#### Morning: File System (2-3 hours)
- [ ] Create FileNode custom node component
- [ ] Implement drag-and-drop file upload to canvas
- [ ] Create API route: POST /api/files (upload to Supabase Storage)
- [ ] Create API route: GET /api/files
- [ ] Implement file-to-chat linking
  - Drag interaction from file node
  - Drop target detection on chat blocks
  - Create file_links record
- [ ] Style connection lines for file links (dashed)
- [ ] Include linked file content in chat context
- [ ] Create API route: POST /api/files/[id]/link

#### Afternoon: Polish & Demo Prep (3-4 hours)
- [ ] Create Minimap component
- [ ] Create empty state with onboarding UI
- [ ] Add loading states and skeletons
- [ ] Add error handling and toast notifications
- [ ] Implement smooth animations
  - Block creation (scale in)
  - Focus mode transition (zoom)
  - Edge drawing (animated dash)
- [ ] Add "New Chat" button and spacebar shortcut
- [ ] Visual polish pass
  - Match mockup colors exactly
  - Shadows and hover states
  - Typography and spacing
- [ ] Test full flow on fresh account
- [ ] Fix any deployment issues
- [ ] Prepare demo script / talking points

**Day 3 Deliverable**: Polished, deployed application ready for demo.

## Environment Variables
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/canvas
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/canvas
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=https://arbor.vercel.app
```

## Success Metrics

For the Pickle interview demo, success means:

1. **Immediate clarity**: Within 5 seconds of seeing the app, the value proposition is obvious
2. **Smooth interactions**: Pan, zoom, drag, and focus transitions feel native
3. **Working AI chat**: Can have real conversations that branch and maintain context
4. **Visual quality**: Looks professional, matches the mockups, no obvious UI bugs
5. **Real infrastructure**: Auth works, data persists, shareable URL
6. **Memorable demo**: The branching interaction creates an "aha" moment

## Demo Script

1. **Open**: Show empty state with tagline "Thoughts branch. So should your conversations."
2. **Create**: Click "+ New Chat", ask a question about a complex topic
3. **Converse**: Show AI responding, continue conversation
4. **Branch**: Highlight an interesting phrase, click Branch, show new block appearing
5. **Context**: In the branched chat, ask a follow-up that proves context was inherited
6. **Spatial**: Zoom out, show the tree structure forming, drag blocks to reorganize
7. **Files**: Drop a file onto canvas, link it to a chat, ask questions about it
8. **Scale**: Show minimap, explain how this scales to dozens of conversations

## Future Enhancements (Post-MVP)

- Real-time collaboration with multiple users
- Export canvas as image or structured document
- Templates for common workflows
- Auto-summarize branches
- Suggest connections between related blocks
- Import conversation history from ChatGPT/Claude
- Mobile-optimized touch interactions
- Keyboard-first navigation mode
- Version history and branch comparison