# Omni end-to-end experience specification

## Standard

Omni is not complete when a screen merely renders. A route is shippable only when its happy path, empty state, loading state, offline state, permission denial, unauthorized path, retry path, refresh behavior and persisted result are verified.

The goal is not a TikTok skin. The goal is TikTok-level interaction clarity, WhatsApp-level trust and messaging reliability, and Instagram-level creator/community breadth—expressed through Omni's own warm graphite, off-white and coral system.

## Current route map

| Route | Current surface | Current behavior | Critical gaps | Target Omni experience |
|---|---|---|---|---|
| `/` | Full-height vertical feed with For You/Following, search and Live entry | Fetches feed and renders large `PostCard` modules | No explicit recommendation contract; fake avatar fallbacks; unclear ranking, diversity, negative feedback and cold start | **Moments**: instant first frame, explainable recommendations, save/share/report/not-interested, captions, data saver, progress memory and resilient prefetch |
| `/search` | Search field with creators, hashtags and posts | Calls `/api/search` and stores recent queries locally | No typed pagination, ranking contract, typo tolerance, safety policy or dedicated result routes | Unified discovery across people, Moments, Circles, sounds and topics, with recent/trending separated from actual results |
| `/create` | Persistence-gated media picker in this PR | Authenticated chunk upload followed by post creation | No camera in the foundation route; no resumable server session; no persisted draft, transcode, captions, cover or real editor | **Studio**: capture/upload, timeline, clips, sound, voiceover, text, captions, cover, credits, audience, draft sync and background render |
| `/live` | Device preflight and capability gate in this PR | Tests camera/microphone but refuses to fabricate a stream | No ingest, SFU, adaptive playback, presence, chat, moderation or replay service | **Rooms**: scheduled or instant live, guest requests, co-host layouts, moderation, reconnect, captions, replay chapters and Circle continuity |
| `/inbox` | Activity/messages tabs | Delegates to notifications and messages | Three routes render the same component without clear deep-link state; notification permission requested too early globally | One inbox with stable tabs, unread filters, requests, mentions, follows, system notices and per-tab URLs |
| `/inbox/activity` | Same Inbox component | Intended activity deep link | Route does not establish the activity tab contract | Activity route must open Activity deterministically and preserve filters across refresh |
| `/inbox/messages` | Same Inbox component | Intended message deep link | Route does not establish the messages tab contract | Messages route must open conversations deterministically and expose requests/archive/search |
| `/messages` | Large combined conversation list and composer module | Calls conversation and message APIs | 1,175-line mixed responsibility screen; optimistic temporary IDs; weak privacy contract; no attachment delivery model | Split list/thread/composer services; request inbox, delivery/read states, retries, voice, attachments, block/report and explicit encryption model |
| `/messages/:id` | Conversation thread | Loads messages for a conversation | Global SSE previously risked cross-user delivery; no pagination/read cursor contract | Authenticated user-scoped realtime channel with pagination, idempotent send, delivery receipts and reconnect reconciliation |
| `/notifications` | Activity list | Calls notification APIs and marks items read | Avatar fallbacks; limited filters; weak pagination and error recovery | Grouped activity with filters, actor context, safe deep links, bulk read and user-controlled push preferences |
| `/profile` | Very large profile/settings/editor module | Loads posts, likes, saved/private items and account state | 1,391-line mixed module; fake default profile; settings and profile concerns combined; many mutable local copies | Modular identity header, relationship actions, Moment grids, collections, creator dashboard and separate settings routes |
| `/profile/:id` | Public profile | Fetches another user and relationship status | Same oversized module and unclear unavailable/private/blocked states | Deterministic public/private/blocked/not-found states, mutual context, Circle overlap and safe messaging entry |
| `/post/:id` | Detail route | Searches a feed page then falls back to direct fetch behavior | Inefficient contract; unclear deleted/private/processing states | Direct typed post endpoint with processing, unavailable, private, removed and retry states plus adjacent discovery |

## Navigation defects

1. Inbox sub-routes must control their selected tab; aliases without route-derived state are misleading.
2. Settings needs its own route tree instead of being embedded in the profile monolith.
3. Create and Live need full-screen route semantics so global navigation cannot cover critical controls.
4. Unknown routes need a branded recovery page rather than a generic server fallback.
5. Every deep link must survive refresh, authentication handoff and installation as a PWA.

## Surface architecture

### App shell

- Safe-area-aware viewport with one navigation model.
- Route-level error boundary and suspense/loading skeleton.
- Auth handoff returns to the exact interrupted action.
- Network state is descriptive, never a substitute for server confirmation.
- Reduced motion, screen-reader labels, 44 px targets and WCAG AA contrast are release requirements.

### Moments feed

- Candidate generation, ranking and policy filtering are separate services.
- Ranking signals include impression, dwell, completion, replay, skip, hide, report, save, share, follow and session satisfaction.
- Provide `Why this Moment?`, topic controls, not-interested and feed reset.
- Protect diversity: creator caps, topic variety, freshness, language, geography and exploration budget.
- Never infer success from client counters; reconcile engagement with the server.

### Studio

- Store an immutable source asset and a versioned edit-decision manifest.
- Generate preview and final output from the same manifest.
- Upload is resumable and idempotent; transcoding is an observable background job.
- A published Moment references ready renditions, captions, cover, credits, rights metadata and policy status.
- Drafts are private, encrypted in transit, recoverable across devices and explicit about local-only media.

### Rooms (Live)

- Control plane: session lifecycle, roles, invitations, moderation, chat and presence.
- Media plane: WebRTC ingest, regional SFU, simulcast, adaptive playback, recording and replay packaging.
- Safety plane: eligibility, age controls, delay, keyword filters, moderators, mute/remove/block/report and emergency stop.
- Reliability: preflight, reconnect, network handoff, quality downgrade, host failover, observability and regional load tests.

### Conversations

- Decide and document whether messages are end-to-end encrypted. Do not imply E2EE unless the protocol actually provides it.
- User-scoped realtime authorization is mandatory.
- Sends use client-generated idempotency keys and server timestamps.
- Attachments use durable object storage, scanning, expiring delivery URLs and retryable upload state.
- Requests, block/report, disappearing messages and backup behavior must have explicit policy.

### Identity, profile and settings

Split the current profile module into:

- `ProfileHeader`
- `RelationshipActions`
- `ProfileMomentGrid`
- `Collections`
- `CreatorDashboard`
- `/settings/account`
- `/settings/privacy`
- `/settings/safety`
- `/settings/notifications`
- `/settings/data`
- `/settings/accessibility`

## Backend gaps blocking “fully operational”

- Durable object storage and CDN renditions.
- Media signature inspection, malware scanning, moderation and transcode workers.
- Idempotent/resumable upload sessions with cleanup.
- Recommendation service, feature store, experimentation and ranking telemetry.
- User-scoped realtime gateway.
- Live control/media/safety planes.
- Report, appeal, block, mute, age and enforcement systems.
- Rate limits, abuse controls, audit logs, CSRF/origin policy and secrets governance.
- Creator ledger, refunds, fraud detection, tax and payout operations before monetization.

## Release gates

### Functional

- Typecheck and production build pass.
- Every route passes happy, empty, loading, error, offline and unauthorized tests.
- Published data survives refresh and a second authenticated device.
- No fixture identities, stock people, fabricated counts or silent success.

### Media

- Upload interruption resumes without duplication.
- Preview matches final render.
- Adaptive playback works under constrained bandwidth.
- Processing, failure and moderation states are visible.

### Safety

- Report, block and mute exist wherever people or content appear.
- Private content cannot leak through feed, search, notifications, media URLs or realtime delivery.
- Live has moderator controls, age policy and emergency termination.

### Experience

- Critical action targets are at least 44 px.
- No overlap at 390 px, 460 px and desktop widths.
- Keyboard, screen reader, reduced-motion and contrast checks pass.
- First meaningful feed frame, interaction latency, upload completion and playback-start targets are measured in production.

## Delivery program

1. **Foundation:** truthful states, auth hardening, typed API client, error boundaries, route contracts and observability.
2. **Media:** object storage, resumable uploads, probing, transcoding, captions and processing UX.
3. **Moments:** feed decomposition, recommendation telemetry, accessible player and negative feedback controls.
4. **Studio:** persisted drafts and render-manifest editor.
5. **Conversations:** scoped realtime, requests, attachments, receipts and safety.
6. **Circles:** community roles, announcements, events, shared collections and moderation.
7. **Rooms:** production live infrastructure and replay.
8. **Creator economy:** analytics, subscriptions and payments after safety and ledger readiness.

A single unverified “remake everything” merge would create another mock product. Omni reaches the competitive bar through this ordered program, with each capability becoming real before its UI claims that it exists.
