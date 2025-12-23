// Server Component - Static content rendered on server
// Interactive parts are in client island components

import { LandingHeader } from "@/components/LandingHeader";
import { LandingCTA } from "@/components/LandingCTA";
import { AuthRedirect } from "@/components/AuthRedirect";

// Floating particles data - computed once at build time
const particles = [0, 1, 2, 3].map((i) => ({
  left: `${20 + i * 20}%`,
  top: `${25 + (i % 2) * 30}%`,
  animationDelay: `${i * 1.2}s`,
  animationDuration: `${7 + i * 2}s`,
}));

export default function Home() {
  return (
    <>
      {/* Auth redirect handler (client) */}
      <AuthRedirect />

      {/* Background layers */}
      <div className="gradient-bg" />
      <div className="dot-pattern" />

      {/* Header with Theme Toggle and Auth (client) */}
      <LandingHeader />

      {/* Floating particles - fewer, subtler */}
      <div className="fixed inset-0 z-1 pointer-events-none overflow-hidden">
        {particles.map((style, i) => (
          <div
            key={i}
            className="particle"
            style={style}
          />
        ))}
      </div>

      {/* Main content - Static, rendered on server */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        {/* Abstract Branching Tree Logo */}
        <div className="logo-container mb-10 animate-fade-in">
          <svg
            width="80"
            height="100"
            viewBox="0 0 80 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Tree trunk */}
            <path
              d="M40 95 L40 50"
              strokeWidth="3"
              strokeLinecap="round"
              className="branch-line"
            />

            {/* Main branches */}
            <path
              d="M40 50 L40 30"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.2s' }}
            />
            <path
              d="M40 55 L25 40"
              strokeWidth="2"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.4s' }}
            />
            <path
              d="M40 55 L55 40"
              strokeWidth="2"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.4s' }}
            />

            {/* Secondary branches */}
            <path
              d="M25 40 L15 28"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.6s' }}
            />
            <path
              d="M25 40 L28 25"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.7s' }}
            />
            <path
              d="M55 40 L65 28"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.6s' }}
            />
            <path
              d="M55 40 L52 25"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.7s' }}
            />
            <path
              d="M40 30 L35 15"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.8s' }}
            />
            <path
              d="M40 30 L45 15"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="branch-line"
              style={{ animationDelay: '0.8s' }}
            />

            {/* Nodes at branch tips - representing thoughts/conversations */}
            <circle cx="15" cy="28" r="4" fill="var(--accent)" className="node-pulse" style={{ animationDelay: '0s' }} />
            <circle cx="28" cy="25" r="3.5" fill="var(--accent-secondary)" className="node-pulse" style={{ animationDelay: '0.3s' }} />
            <circle cx="35" cy="15" r="4" fill="var(--accent)" className="node-pulse" style={{ animationDelay: '0.6s' }} />
            <circle cx="45" cy="15" r="3.5" fill="var(--accent-nature)" className="node-pulse" style={{ animationDelay: '0.9s' }} />
            <circle cx="52" cy="25" r="3.5" fill="var(--accent-secondary)" className="node-pulse" style={{ animationDelay: '1.2s' }} />
            <circle cx="65" cy="28" r="4" fill="var(--accent)" className="node-pulse" style={{ animationDelay: '1.5s' }} />

            {/* Root/origin node */}
            <circle cx="40" cy="95" r="5" fill="var(--foreground)" style={{ transition: 'fill 0.3s ease' }} />
          </svg>
        </div>

        {/* Main tagline */}
        <div className="text-center animate-fade-in-delay">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-tight">
            <span className="text-gradient">Thoughts branch,</span>
            <br />
            <span style={{ color: 'var(--foreground)' }}>So should your conversations.</span>
          </h1>
        </div>

        {/* CTA Button (client) */}
        <LandingCTA />
      </main>
    </>
  );
}
