
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { aiErrorLogs } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const { userId: authUserId } = await auth();
        const body = await req.json();
        const { model, inputMessages, errorType, rawOutput } = body;

        // Use authenticated user ID, or 'anonymous' if not logged in (though unauthorized requests shouldn't reach here ideally, but for logging it's fine)
        const userId = authUserId || 'anonymous';

        await db.insert(aiErrorLogs).values({
            userId,
            model: model || 'unknown',
            inputMessages: inputMessages || [],
            errorType: errorType || 'unknown_error',
            rawOutput: rawOutput || null,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to log AI error:', error);
        // Fail silently to not impact the user experience
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
