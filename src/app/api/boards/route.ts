import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { boards, users, chatBlocks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/boards - Fetch all boards for the authenticated user
export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userBoards = await db
            .select()
            .from(boards)
            .where(eq(boards.userId, userId))
            .orderBy(desc(boards.updatedAt));

        return NextResponse.json(userBoards);
    } catch (error) {
        console.error('Error fetching boards:', error);
        return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
    }
}

// POST /api/boards - Create a new board for the authenticated user
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body for optional board name
        const body = await request.json().catch(() => ({}));
        const name = body.name || 'Untitled Board';

        // Ensure user exists in database (they should from Clerk webhook, but let's be safe)
        const existingUser = await db.select().from(users).where(eq(users.id, userId));
        if (existingUser.length === 0) {
            // Create user if they don't exist
            const currentUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
                },
            });

            if (currentUser.ok) {
                const userData = await currentUser.json();
                await db.insert(users).values({
                    id: userId,
                    email: userData.email_addresses?.[0]?.email_address || `${userId}@arbor.app`,
                    name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || null,
                    imageUrl: userData.image_url || null,
                });
            } else {
                // Fallback: create minimal user record
                await db.insert(users).values({
                    id: userId,
                    email: `${userId}@arbor.app`,
                });
            }
        }

        // Create the new board
        const [newBoard] = await db
            .insert(boards)
            .values({
                userId,
                name,
            })
            .returning();

        // If it's a default "Untitled Board", automatically add a starter chat block
        if (name === 'Untitled Board') {
            await db.insert(chatBlocks).values({
                boardId: newBoard.id,
                title: 'New Chat',
                positionX: 0,
                positionY: 0,
                model: 'anthropic/claude-sonnet-4-5-20250929',
            });
        }

        return NextResponse.json(newBoard, { status: 201 });
    } catch (error) {
        console.error('Error creating board:', error);
        return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
    }
}
