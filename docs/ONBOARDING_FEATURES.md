# Arbor Onboarding & Tutorial Features

A discreet, non-intrusive approach to teaching users how to use Arbor's infinite canvas chat experience.

---

## 🎯 Design Philosophy

**Discreet Learning**: Users should discover features naturally through subtle hints, not forced tutorials. The app should feel intuitive from the first moment.

---

## ✨ Proposed Features

### 1. **Empty State Guidance**
- Show helpful prompts when canvas/sidebar is empty
- "Click anywhere to start a conversation" on empty canvas
- Subtle animated arrow pointing to the + button
- Disappears after first action

### 2. **Contextual Tooltips**
- Appear on first hover over key UI elements
- Small, dismissible "tip" badges
- Examples:
  - Handle dots: "Drag to connect chat blocks"
  - Context handle (right): "Link for AI context sharing"
  - Resize corners: "Drag to resize"
  - Model dropdown: "Switch AI models"

### 3. **Progressive Disclosure Hints**
- Subtle pulsing glow on undiscovered features
- "New" badges that fade after interaction
- Keyboard shortcut hints that appear after repeated mouse actions
  - e.g., After 3 manual zooms: "Tip: Use scroll to zoom"

### 4. **First-Time Feature Spotlights**
Triggered once per feature, per user:
- **First chat block**: "Double-click to expand • Drag to move"
- **First branch**: "You've created a branch! Connected blocks share context."
- **First image upload**: "Images become AI context when connected"
- **First sticky note**: "Connect to chat blocks to provide notes as context"

### 5. **Keyboard Shortcut Overlay**
- Press `?` to show all shortcuts
- Minimal overlay, not a modal
- Categories: Navigation, Creation, Editing

### 6. **Interactive Walkthrough (Optional)**
- "Show me around" button in empty state
- Creates a demo canvas with annotated blocks
- User can interact with real examples
- Delete demo when done

### 7. **Smart Empty Chat Prompts**
- Rotating starter prompts in empty chat blocks
- Context-aware suggestions based on connections
- "This chat has image context - try asking about it!"

### 8. **Edge Animation Hints**
- When dragging from a handle, show ghost lines to valid targets
- Highlight compatible drop zones
- Error prevention over error messages

### 9. **Celebration Micro-Interactions**
- Subtle confetti on first successful:
  - Context link created
  - Branch created
  - Multi-block conversation
- Builds positive reinforcement without being annoying

### 10. **Help Menu & Documentation**
- `?` icon in corner (or toolbar)
- Links to:
  - Quick Tips (in-app)
  - Full Documentation (external)
  - Keyboard Shortcuts
  - "What's New" changelog

---

## 🗂️ Implementation Priority

| Priority | Feature | Effort |
|----------|---------|--------|
| P0 | Empty state guidance | Low |
| P0 | Contextual tooltips | Medium |
| P1 | First-time spotlights | Medium |
| P1 | Keyboard shortcut overlay | Low |
| P2 | Progressive disclosure hints | Medium |
| P2 | Smart empty chat prompts | Low |
| P3 | Interactive walkthrough | High |
| P3 | Celebration micro-interactions | Low |

---

## 💾 Persistence

Use `localStorage` to track:
```typescript
interface OnboardingState {
  hasSeenCanvasTip: boolean;
  hasCreatedFirstBlock: boolean;
  hasCreatedFirstBranch: boolean;
  hasConnectedContext: boolean;
  hasUploadedImage: boolean;
  hasUsedStickyNote: boolean;
  dismissedTips: string[];
}
```

---

## 🎨 Visual Language

- **Subtle**: Never interrupt the user's flow
- **Helpful**: Appear at the right moment
- **Dismissible**: Always can be closed/skipped
- **Consistent**: Same animation style throughout
- **Accessible**: Readable, proper contrast, keyboard navigable
