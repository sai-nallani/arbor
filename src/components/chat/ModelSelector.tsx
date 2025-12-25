'use client';

import { useState, useRef, useEffect } from 'react';

interface ModelOption {
    value: string;
    label: string;
}

interface ModelSelectorProps {
    model: string;
    options: ModelOption[];
    onChange: (model: string) => void;
    disabled?: boolean;
    disabledReason?: string;
}

export default function ModelSelector({ model, options, onChange, disabled = false, disabledReason }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(opt => opt.value === model) || { value: model, label: model };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleSelect = (value: string) => {
        onChange(value);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className="model-selector-container relative"
            title={disabled ? disabledReason : 'Select Model'}
        >
            <button
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                    border border-white/10 outline-none
                    ${disabled
                        ? 'bg-white/5 opacity-50 cursor-not-allowed'
                        : 'bg-white/5 hover:bg-white/10 cursor-pointer active:scale-95'
                    }
                    ${isOpen ? 'ring-1 ring-white/20 bg-white/10' : ''}
                `}
                onClick={handleToggle}
                style={{
                    backdropFilter: 'blur(8px)',
                    color: '#e5e5e5',
                    minWidth: '140px',
                    justifyContent: 'space-between'
                }}
                disabled={disabled}
            >
                <span className="truncate">{selectedOption.label}</span>
                <svg
                    width="12" // Slightly larger for better visibility
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    style={{ opacity: 0.7 }}
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-2 w-[220px] max-h-[300px] overflow-y-auto rounded-xl border border-white/10 bg-[#121212]/90 shadow-2xl z-[9999]"
                    style={{
                        backdropFilter: 'blur(16px)',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                        animation: 'fadeIn 0.1s ease-out'
                    }}
                >
                    <div className="p-1 space-y-0.5">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleSelect(opt.value)}
                                className={`
                                    w-full text-left px-3 py-2 rounded-lg text-xs transition-colors duration-150
                                    flex items-center justify-between group
                                    ${model === opt.value
                                        ? 'bg-[#A67B5B]/20 text-[#D4B499]'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }
                                `}
                            >
                                <span className="font-medium">{opt.label}</span>
                                {model === opt.value && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
