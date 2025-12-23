"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useTheme } from "@/hooks/useTheme";
import { clerkAppearance } from "@/lib/clerk-appearance";

export function LandingHeader() {
    const { isDark, mounted, toggleTheme } = useTheme();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 animate-fade-in">
            {/* Logo/Brand */}
            <div className="text-sm tracking-widest uppercase font-medium" style={{ color: 'var(--muted)' }}>
                Arbor
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-6">
                {/* Theme Toggle - only show after mount to prevent hydration mismatch */}
                {mounted && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
                            {isDark ? "Dark" : "Light"}
                        </span>
                        <button
                            className="toggle-switch"
                            onClick={toggleTheme}
                            aria-label="Toggle dark mode"
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
                )}

                {/* Auth */}
                <SignedOut>
                    <SignInButton mode="modal">
                        <button className="new-board-btn">
                            New Board
                        </button>
                    </SignInButton>
                </SignedOut>
                <SignedIn>
                    <a href="/canvas" className="new-board-btn">
                        New Board
                    </a>
                    <UserButton
                        afterSignOutUrl="/"
                        appearance={{
                            elements: {
                                avatarBox: "w-9 h-9"
                            }
                        }}
                    />
                </SignedIn>
            </div>
        </header>
    );
}
