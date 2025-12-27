// Server Component - Static content rendered on server
// Interactive parts are in client island components

import { LandingHeader } from "@/components/LandingHeader";
import { LandingCTA } from "@/components/LandingCTA";
import { AuthRedirect } from "@/components/AuthRedirect";

export default function Home() {
  return (
    <div className="landing-page">
      {/* Auth redirect handler (client) */}
      <AuthRedirect />

      {/* Background layers */}
      <div className="gradient-bg" />
      <div className="dot-pattern" />

      {/* Header with Theme Toggle and Auth (client) */}
      <LandingHeader />

      {/* Hero Section - Centered */}
      <section className="landing-hero-centered">
        <div className="logo-container mb-8 animate-fade-in">
          <svg
            width="80"
            height="100"
            viewBox="0 0 80 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M40 95 L40 50" strokeWidth="3" strokeLinecap="round" className="branch-line" />
            <path d="M40 50 L40 30" strokeWidth="2.5" strokeLinecap="round" className="branch-line" style={{ animationDelay: '0.2s' }} />
            <path d="M40 55 L25 40" strokeWidth="2" strokeLinecap="round" className="branch-line" style={{ animationDelay: '0.4s' }} />
            <path d="M40 55 L55 40" strokeWidth="2" strokeLinecap="round" className="branch-line" style={{ animationDelay: '0.4s' }} />
            <path d="M25 40 L15 28" strokeWidth="1.5" strokeLinecap="round" className="branch-line" style={{ animationDelay: '0.6s' }} />
            <path d="M55 40 L65 28" strokeWidth="1.5" strokeLinecap="round" className="branch-line" style={{ animationDelay: '0.6s' }} />
            <circle cx="15" cy="28" r="4" fill="var(--accent)" className="node-pulse" />
            <circle cx="35" cy="15" r="4" fill="var(--accent)" className="node-pulse" style={{ animationDelay: '0.6s' }} />
            <circle cx="45" cy="15" r="3.5" fill="var(--accent-nature)" className="node-pulse" style={{ animationDelay: '0.9s' }} />
            <circle cx="65" cy="28" r="4" fill="var(--accent)" className="node-pulse" style={{ animationDelay: '1.5s' }} />
            <circle cx="40" cy="95" r="5" fill="var(--foreground)" />
          </svg>
        </div>
        <h1 className="hero-title-centered animate-fade-in-delay">
          <span className="text-gradient">Thoughts branch,</span>
          <br />
          So should your conversations.
        </h1>
        <p className="hero-subtitle-centered animate-fade-in-delay">
          A canvas for AI conversations. Branch, link, and explore ideas visually.
        </p>

        {/* Scroll indicator */}
        <div className="scroll-indicator animate-fade-in-delay-2">
          <span>Scroll to explore</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* Feature 1: Branching - Image Left */}
      <section className="feature-section">
        <div className="feature-image-side">
          <img src="/branching.png" alt="Branching" className="feature-screenshot" />
        </div>
        <div className="feature-content-side">
          <div className="feature-number">01</div>
          <h2 className="feature-heading">Branching</h2>
          <p className="feature-text">
            Highlight any text in a conversation and branch into a new thread.
            Explore different directions without losing your original context.
          </p>
        </div>
      </section>

      {/* Feature 2: Context Management - Image Right */}
      <section className="feature-section reverse">
        <div className="feature-image-side">
          <img src="/contextmanagement.png" alt="Context Management" className="feature-screenshot" />
        </div>
        <div className="feature-content-side">
          <div className="feature-number">02</div>
          <h2 className="feature-heading">Context Management</h2>
          <p className="feature-text">
            Visually link files, images, and sticky notes to your conversations.
            Give AI the context it needs with a simple drag-and-drop.
          </p>
        </div>
      </section>

      {/* Feature 3: Multitasking - Image Left */}
      <section className="feature-section">
        <div className="feature-image-side">
          <img src="/ultimatemultitasking.png" alt="Ultimate Multitasking" className="feature-screenshot" />
        </div>
        <div className="feature-content-side">
          <div className="feature-number">03</div>
          <h2 className="feature-heading">Ultimate Multitasking</h2>
          <p className="feature-text">
            Run multiple parallel conversations on an infinite canvas.
            Compare insights, cross-reference ideas, and think bigger.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="landing-final-cta">
        <h2 className="final-cta-title">Ready to branch out?</h2>
        <p className="final-cta-subtitle">Start exploring with AI, visually.</p>
        <LandingCTA />
      </section>
    </div>
  );
}
