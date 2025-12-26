/**
 * Storage-only Image Upload API Route
 * 
 * POST /api/images/upload - Upload image to Supabase Storage only (no database record)
 * Used for preview before message send - database record created later
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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

        // Upload to Supabase Storage only (no database record yet)
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

        console.log('[POST /api/images/upload] Uploaded to storage (no DB record yet):', urlData.publicUrl);

        // Return URL and metadata for later database creation
        return NextResponse.json({
            url: urlData.publicUrl,
            name: file.name,
            mimeType: file.type,
            storagePath: uploadData.path,
        });

    } catch (error: any) {
        console.error('Image storage upload error:', error);
        return NextResponse.json({
            error: error?.message || 'Upload failed',
            details: String(error)
        }, { status: 500 });
    }
}
