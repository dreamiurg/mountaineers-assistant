# Mountaineers Assistant Feature Brainstorm

**Date:** 2026-01-23
**Primary Persona:** Active outdoor enthusiast who wants to discover activities, track their outdoor resume, and reconnect with climbing partners.

---

## Phase 1: Deepen Analytics (Priority: HIGH)

Double down on the extension's core strength - analytics and tracking - before expanding into new territory.

### 1.1 Year-over-Year Comparison Dashboard
**Description:** New dashboard section showing comparative stats between years with visual charts.
**Value:** Creates "aha" moments - "I did 30% more climbing than last year!"
**Metrics to include:**
- Volume: Total activities, total partners, unique locations
- Growth: New activity types tried, new partners met, difficulty progression

**Complexity:** M
**Dependencies:** Existing cache with historical data

### 1.2 Outdoor Resume - Dashboard Tab
**Description:** New tab showing accomplishments summary - activity totals by type, peak lists, partner hall of fame, personal records.
**Value:** Personal satisfaction and tracking; validates the data model before making it shareable.
**Complexity:** M
**Dependencies:** None (uses existing data)

### 1.3 Outdoor Resume - Exportable Card
**Description:** Generate shareable image (like Spotify Wrapped) with yearly highlights.
**Value:** Viral potential - users share accomplishments on social media, drives extension awareness.
**Complexity:** L
**Dependencies:** 1.2 Dashboard Tab (validates what resonates)

---

## Phase 2: Discovery Features (Priority: MEDIUM)

Once tracking experience is exceptional, help users find their next adventure.

### 2.1 Activity Watchlist
**Description:** Save activities to a watchlist and get notified when registration opens.
**Value:** Never miss registration for popular activities that fill up fast.
**Complexity:** M
**Dependencies:** Content script enhancement, notification system

### 2.2 Activity Quick Filters
**Description:** Popup widget with saved filters for quick activity discovery without navigating full site.
**Value:** Reduces friction for finding activities matching user preferences.
**Complexity:** M
**Dependencies:** Understanding of mountaineers.org filter parameters

### 2.3 Recommended Activities
**Description:** Suggest activities based on user's history (activity types, difficulty level, partners).
**Value:** Personalized discovery based on demonstrated preferences.
**Complexity:** L
**Dependencies:** 2.2, robust activity categorization

---

## Phase 3: Social Features (Priority: MEDIUM)

Extend existing partner tracking into active social features.

### 3.1 Partner Reconnection
**Description:** Highlight partners you haven't climbed with in 6+ months; suggest reaching out.
**Value:** Maintains climbing relationships and community bonds.
**Complexity:** S
**Dependencies:** None (uses existing partner data)

### 3.2 Climbing Partner Finder
**Description:** When viewing an activity, show which of your past partners are also registered.
**Value:** Join activities with people you already know and trust.
**Complexity:** M
**Dependencies:** Content script enhancement, roster data access

### 3.3 Partner Compatibility
**Description:** Show overlap statistics with potential partners - shared activity types, difficulty levels, schedule patterns.
**Value:** Find compatible climbing partners for future activities.
**Complexity:** M
**Dependencies:** 3.2, enhanced partner data model

---

## Phase 4: Goals & Milestones (Priority: LOW)

Add gamification once core tracking is solid.

### 4.1 Personal Goals
**Description:** Set goals like "Complete 50 activities this year" or "Try 3 new activity types."
**Value:** Motivation through goal-setting and progress tracking.
**Complexity:** M
**Dependencies:** None

### 4.2 Achievement Badges
**Description:** Unlock badges for milestones - "Century Club" (100 activities), "Explorer" (5+ activity types), "Connector" (20+ unique partners).
**Value:** Gamification creates engagement and shareable moments.
**Complexity:** M
**Dependencies:** Badge design, 4.1 optional

### 4.3 Skill Progression Tracking
**Description:** Track advancement through difficulty levels within activity types.
**Value:** Shows growth trajectory, suggests "ready for next challenge."
**Complexity:** L
**Dependencies:** Complex data modeling for difficulty normalization across activity types

---

## Phase 5: Notifications & Real-time (Priority: LOW)

Add proactive awareness features.

### 5.1 Registration Alerts
**Description:** Browser notifications when watched activities open for registration.
**Value:** Critical for popular activities that fill in minutes.
**Complexity:** M
**Dependencies:** 2.1 Watchlist, notification permissions

### 5.2 Activity Updates
**Description:** Notify when registered activities have changes (time, location, cancellation).
**Value:** Stay informed without checking the website constantly.
**Complexity:** M
**Dependencies:** Periodic background sync, change detection

### 5.3 Trip Report Notifications
**Description:** Alert when new trip reports are posted for activities user participated in.
**Value:** Discover photos and writeups from shared experiences.
**Complexity:** S
**Dependencies:** Trip report scraping

---

## Deferred / Future Consideration

### Gear Library Integration
**Description:** Quick lookup of gear library availability and checkout status.
**Value:** Useful for members who borrow gear frequently.
**Complexity:** M
**Reason for deferral:** Smaller audience, separate system integration

### Trip Leader Tools
**Description:** Dashboard for leaders to manage their upcoming activities, roster, waitlist.
**Value:** Streamlines leader workflow.
**Complexity:** L
**Reason for deferral:** Smaller audience (leaders), requires leader-specific data access

### Offline Mode
**Description:** Cache activity data for offline access.
**Value:** Useful in backcountry with no connectivity.
**Complexity:** M
**Reason for deferral:** Extension already caches data locally; incremental value is low

### Mobile PWA
**Description:** Progressive web app version for mobile access.
**Value:** Extension is desktop-only; mobile would expand reach.
**Complexity:** L
**Reason for deferral:** Requires separate architecture, different platform constraints

---

## Implementation Roadmap

| Phase | Features | Complexity |
|-------|----------|------------|
| 1a | YoY Comparison Dashboard | M |
| 1b | Outdoor Resume - Dashboard Tab | M |
| 1c | Outdoor Resume - Exportable Card | L |
| 2a | Activity Watchlist | M |
| 2b | Partner Reconnection | S |
| 3 | Goals & Milestones | M |
| 4 | Notifications | M |

**Recommended starting point:** Phase 1a (YoY Comparison) - leverages existing data, high engagement potential, validates direction before larger investments.

---

## Appendix: Existing Features (for reference)

- Activity history sync with caching
- Analytics dashboard (timeline, type distribution, partner tracking, role distribution)
- Multi-dimensional filtering (type, category, role, partner)
- Calendar export with registration reminders
- Shared activities display on member profiles
- Error diagnostics and reporting
- User preferences (avatars, fetch limits, data export/import)
