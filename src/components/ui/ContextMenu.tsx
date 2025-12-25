'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Action {
    label: string;
    onClick: () => void;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    actions: Action[];
    onClose: () => void;
    persist?: boolean;
}

export default function ContextMenu({ x, y, actions, onClose, persist = false }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        // Delay attaching to avoid immediate closing from the triggering click
        setTimeout(() => {
            if (!persist) {
                document.addEventListener('click', handleClickOutside);
                document.addEventListener('contextmenu', handleClickOutside); // Context menu elsewhere closes this one
            }
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('contextmenu', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose, persist]);

    // Use a portal to render outside of any transformed parents (like React Flow nodes)
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                top: y,
                left: x,
            }}
        >
            {actions.map((action, index) => (
                <button
                    key={index}
                    className={`context-menu-item ${action.danger ? 'danger' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                        onClose();
                    }}
                >
                    {action.label}
                </button>
            ))}
        </div>,
        document.body
    );
}
