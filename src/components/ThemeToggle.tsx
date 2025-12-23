"use client";

import { useTheme } from '@/hooks/useTheme';

interface ThemeToggleProps {
    isCollapsed?: boolean;
}

export function ThemeToggle({ isCollapsed = false }: ThemeToggleProps) {
    const { isDark, mounted, toggleTheme } = useTheme();

    // Don't render until mounted to prevent hydration mismatch
    if (!mounted) {
        return <div className="theme-toggle-placeholder" style={{ height: '28px' }} />;
    }

    return (
        <div className={`theme-toggle-container ${isCollapsed ? 'collapsed' : ''}`}>
            {!isCollapsed && (
                <span className="theme-toggle-label">
                    {isDark ? "Dark" : "Light"}
                </span>
            )}
            <button
                className="toggle-switch"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
                {/* Sun icon */}
                <svg
                    className="toggle-icon sun"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ color: isDark ? 'var(--muted)' : 'var(--accent)' }}
                >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                {/* Moon icon */}
                <svg
                    className="toggle-icon moon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ color: isDark ? 'var(--accent)' : 'var(--muted)' }}
                >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            </button>
        </div>
    );
}
