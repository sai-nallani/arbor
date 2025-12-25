/**
 * Image Upload API Route
 * 
 * POST /api/images - Upload image to Supabase Storage and create fileNode entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { fileNodes } from '@/db/schema';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const boardId = formData.get('boardId') as string;
        const positionX = parseFloat(formData.get('positionX') as string) || 0;
        const positionY = parseFloat(formData.get('positionY') as string) || 0;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!boardId) {
            return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
        }

        // Check file size (25MB limit)
        const MAX_SIZE = 25 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum 25MB allowed.' }, { status: 400 });
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
        }

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .upload(fileName, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('images')
            .getPublicUrl(uploadData.path);

        console.log('[POST /api/images] Uploaded to storage, creating DB entry...');

        // Create fileNode entry in database
        const insertValues = {
            boardId,
            name: file.name,
            mimeType: file.type,
            url: urlData.publicUrl,
            positionX,
            positionY,
        };
        console.log('[POST /api/images] Inserting values:', JSON.stringify(insertValues));

        const returningResult = await db.insert(fileNodes).values(insertValues).returning();
        console.log('[POST /api/images] Raw returning result:', JSON.stringify(returningResult));

        if (!returningResult || returningResult.length === 0) {
            console.error('[POST /api/images] Database insert failed or returned no data');
            throw new Error('Database insert failed');
        }

        const fileNode = returningResult[0];
        console.log('[POST /api/images] File node created with ID:', fileNode.id);

        const responsePayload = {
            id: fileNode.id,
            name: fileNode.name,
            url: fileNode.url,
            mimeType: fileNode.mimeType,
            positionX: fileNode.positionX,
            positionY: fileNode.positionY,
        };

        console.log('[POST /api/images] Returning payload:', JSON.stringify(responsePayload));
        return NextResponse.json(responsePayload);

    } catch (error: any) {
        console.error('Image upload error:', error);
        return NextResponse.json({
            error: error?.message || 'Upload failed',
            details: String(error)
        }, { status: 500 });
    }
}
