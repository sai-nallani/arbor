"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export function LandingCTA() {
    return (
        <div className="mt-12 animate-fade-in-delay" style={{ animationDelay: '0.5s', opacity: 0 }}>
            <SignedOut>
                <SignInButton mode="modal" fallbackRedirectUrl="/chat">
                    <button className="cta-btn">
                        Get Started
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                </SignInButton>
            </SignedOut>
            <SignedIn>
                <a href="/chat" className="cta-btn">
                    Open Canvas
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </a>
            </SignedIn>
        </div>
    );
}
