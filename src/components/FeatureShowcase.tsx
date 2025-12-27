'use client';

import { useState } from 'react';

const features = [
    {
        id: 'branching',
        title: 'Branching',
        description: 'Branch from any point in your conversation',
        image: '/branching.png',
    },
    {
        id: 'context',
        title: 'Context Management',
        description: 'Visually link files, images, and notes',
        image: '/contextmanagement.png',
    },
    {
        id: 'multitask',
        title: 'Ultimate Multitasking',
        description: 'Run parallel conversations on an infinite canvas',
        image: '/ultimatemultitasking.png',
    },
];

export function FeatureShowcase() {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState<string>('');

    const openPreview = (image: string, title: string) => {
        setPreviewImage(image);
        setPreviewTitle(title);
    };

    const closePreview = () => {
        setPreviewImage(null);
        setPreviewTitle('');
    };

    return (
        <>
            {/* Feature Cards */}
            <div className="mt-16 w-full max-w-5xl animate-fade-in-delay-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="feature-card-clickable"
                            onClick={() => openPreview(feature.image, feature.title)}
                        >
                            <div className="feature-image-container-clickable">
                                <img
                                    src={feature.image}
                                    alt={feature.title}
                                    className="feature-image"
                                />
                                {/* Expand icon overlay */}
                                <div className="feature-expand-overlay">
                                    <svg
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="15 3 21 3 21 9" />
                                        <polyline points="9 21 3 21 3 15" />
                                        <line x1="21" y1="3" x2="14" y2="10" />
                                        <line x1="3" y1="21" x2="10" y2="14" />
                                    </svg>
                                    <span>Click to preview</span>
                                </div>
                            </div>
                            <h3 className="feature-title">{feature.title}</h3>
                        </div>
                    ))}
                </div>
            </div>

            {/* Preview Modal */}
            {previewImage && (
                <div className="feature-preview-modal" onClick={closePreview}>
                    <div className="feature-preview-content" onClick={(e) => e.stopPropagation()}>
                        <button className="feature-preview-close" onClick={closePreview}>
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <h2 className="feature-preview-title">{previewTitle}</h2>
                        <img
                            src={previewImage}
                            alt={previewTitle}
                            className="feature-preview-image"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
