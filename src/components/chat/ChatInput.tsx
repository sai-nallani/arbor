'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

export interface AttachedImage {
    file: File;
    previewUrl: string;
    uploading?: boolean;
    uploadedUrl?: string;
    uploadedName?: string;    // Original filename for DB record
    uploadedMimeType?: string; // MIME type for DB record
}

export interface UploadedImageInfo {
    id: string;
    url: string;
    name: string;
    mimeType?: string;
}

interface ChatInputProps {
    onSend: (content: string, images?: string[]) => void;
    isLoading: boolean;
    onStop?: () => void;
    placeholder?: string;
    compact?: boolean;
    isSearchEnabled?: boolean;
    onSearchToggle?: (enabled: boolean) => void;
    boardId?: string;
    onImagesChange?: (hasImages: boolean) => void;
    onImageUploaded?: (imageInfo: UploadedImageInfo) => void;
    thinkHarderEnabled?: boolean;
    isThinkHarderDisabled?: boolean; // e.g. if model doesn't support reasoning
    onThinkHarderToggle?: (enabled: boolean) => void;
}

export default function ChatInput({
    onSend,
    isLoading,
    onStop,
    placeholder = 'Type a message...',
    compact = false,
    isSearchEnabled = false,
    onSearchToggle,
    boardId,
    onImagesChange,
    onImageUploaded,
    thinkHarderEnabled = false,
    isThinkHarderDisabled = false,
    onThinkHarderToggle,
}: ChatInputProps) {
    const [value, setValue] = useState('');
    const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Notify parent when images change
    useEffect(() => {
        onImagesChange?.(attachedImages.length > 0);
    }, [attachedImages.length, onImagesChange]);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [value]);

    const uploadImage = async (file: File): Promise<{ url: string; name: string; mimeType: string; id: string } | null> => {
        if (!boardId) {
            console.error('[ChatInput] No boardId provided for image upload');
            return null;
        }

        // Upload to storage AND create DB record immediately so canvas node appears
        // console.log(`[ChatInput] Uploading image and creating DB record: ${file.name}`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('boardId', boardId);
        formData.append('positionX', '0');
        formData.append('positionY', '0');

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            // console.log('[ChatInput] Upload response:', data);

            if (response.ok) {
                // Notify parent to create canvas node immediately
                onImageUploaded?.({
                    id: data.id,
                    url: data.url,
                    name: data.name,
                    mimeType: data.mimeType
                });
                return { url: data.url, name: data.name, mimeType: data.mimeType, id: data.id };
            } else {
                console.error('[ChatInput] Upload failed:', response.status, data);
                return null;
            }
        } catch (error) {
            console.error('[ChatInput] Network error during upload:', error);
            return null;
        }
    };

    // Handle file selection
    const handleFileSelect = async (files: FileList | null) => {
        if (!files) return;

        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        // Add to attached with preview
        const newImages: AttachedImage[] = imageFiles.map(file => ({
            file,
            previewUrl: URL.createObjectURL(file),
            uploading: true,
        }));

        setAttachedImages(prev => [...prev, ...newImages]);

        // Upload each
        for (let i = 0; i < newImages.length; i++) {
            const result = await uploadImage(newImages[i].file);

            setAttachedImages(prev => prev.map((img) => {
                if (img.previewUrl === newImages[i].previewUrl) {
                    return {
                        ...img,
                        uploading: false,
                        uploadedUrl: result?.url,
                        uploadedName: result?.name,
                        uploadedMimeType: result?.mimeType,
                    };
                }
                return img;
            }));
        }
    };

    // Handle paste
    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) imageFiles.push(file);
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            const dataTransfer = new DataTransfer();
            imageFiles.forEach(f => dataTransfer.items.add(f));
            handleFileSelect(dataTransfer.files);
        }
    };

    // Remove attached image
    const removeImage = (previewUrl: string) => {
        setAttachedImages(prev => {
            const toRemove = prev.find(img => img.previewUrl === previewUrl);
            if (toRemove) {
                URL.revokeObjectURL(toRemove.previewUrl);
            }
            return prev.filter(img => img.previewUrl !== previewUrl);
        });
    };

    // Handle send
    const handleSend = async () => {
        const trimmed = value.trim();
        const uploadedImages = attachedImages.filter(img => img.uploadedUrl);
        const uploadedUrls = uploadedImages.map(img => img.uploadedUrl!);

        if (!trimmed && uploadedUrls.length === 0) return;
        if (isLoading) return;

        // Check if any images still uploading
        if (attachedImages.some(img => img.uploading)) {
            alert('Please wait for images to finish uploading');
            return;
        }

        // DB records and canvas nodes are created immediately during upload
        // No need to create them here

        onSend(trimmed, uploadedUrls.length > 0 ? uploadedUrls : undefined);
        setValue('');

        // Clear attached images
        attachedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setAttachedImages([]);

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    // Handle keyboard
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`chat-input-wrapper ${compact ? 'compact' : ''}`}>
            {/* Attached images preview */}
            {attachedImages.length > 0 && (
                <div className="attached-images-preview">
                    {attachedImages.map((img) => (
                        <div key={img.previewUrl} className={`attached-image ${img.uploading ? 'uploading' : ''}`}>
                            <img src={img.previewUrl} alt="Attached" />
                            {img.uploading && <div className="upload-spinner" />}
                            <button
                                className="remove-image-btn"
                                onClick={() => removeImage(img.previewUrl)}
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="chat-input-card">
                <textarea
                    ref={textareaRef}
                    className="chat-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={compact ? "Type a message..." : "Reply to Arbor..."}
                    disabled={isLoading}
                    rows={1}
                />
                <div className="chat-input-footer">
                    <div className="chat-input-tools">
                        {/* Image attachment button */}
                        <button
                            className="chat-tool-btn"
                            type="button"
                            title="Attach image"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,.png,.jpg,.jpeg,.webp,.heic"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />

                        <button
                            className={`chat-tool-btn ${isSearchEnabled ? 'active' : ''}`}
                            type="button"
                            title="Toggle Deep Research (1/day)"
                            onClick={() => onSearchToggle?.(!isSearchEnabled)}
                            style={{
                                color: isSearchEnabled ? 'var(--accent)' : 'currentColor',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                width: 'auto',
                                paddingRight: '12px'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Deep Research</span>
                        </button>

                        <button
                            className={`chat-tool-btn ${thinkHarderEnabled ? 'active' : ''}`}
                            type="button"
                            title={isThinkHarderDisabled ? "Think Harder (Only available for GPT-5.1)" : "Toggle Think Harder"}
                            onClick={() => !isThinkHarderDisabled && onThinkHarderToggle?.(!thinkHarderEnabled)}
                            disabled={isThinkHarderDisabled}
                            style={{
                                color: thinkHarderEnabled && !isThinkHarderDisabled ? 'var(--accent)' : 'currentColor',
                                opacity: isThinkHarderDisabled ? 0.4 : 1,
                                cursor: isThinkHarderDisabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                width: 'auto',
                                paddingRight: '8px'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                                <path d="M12 5v13" />
                            </svg>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Think Harder</span>
                        </button>
                    </div>
                    <div className="chat-input-actions">
                        {isLoading ? (
                            <button
                                className="chat-stop-btn-icon"
                                onClick={onStop}
                                type="button"
                                title="Stop generating"
                            >
                                <div className="stop-icon-square" />
                            </button>
                        ) : (
                            <button
                                className="chat-send-btn-icon"
                                onClick={handleSend}
                                disabled={!value.trim() && attachedImages.length === 0}
                                type="button"
                                title="Send message"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
