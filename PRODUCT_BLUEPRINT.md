# Omni product blueprint

## Product thesis

Omni should not be a visual clone. It should combine the best proven interaction patterns with a distinct promise: **create once, gather your people, and continue the relationship without losing context or control**.

The current warm graphite, off-white and coral visual system remains Omni's identity. Familiarity should come from predictable gestures and workflows—not copied branding, trade dress, wording or proprietary assets.

## What leading products prove

### TikTok

TikTok's core advantage is a low-friction vertical discovery loop connected directly to creation. Its official product and support material describes multi-clip creation, sounds, effects, text, editing, playlists, stitches, LIVE discovery, multi-guest hosting, moderation, gifts and subscriptions.

Sources:
- https://support.tiktok.com/en/using-tiktok/creating-videos
- https://support.tiktok.com/en/live-gifts-wallet/tiktok-live/what-is-tiktok-live
- https://newsroom.tiktok.com/en-us/product
- https://newsroom.tiktok.com/en-us/empowering-creators-and-fostering-communities-with-the-expanded-subscription-feature

### Instagram

Instagram connects Reels, Stories, Live and creator channels. Its published creator guidance emphasizes undo/redo, drafts, reusable media, voiceover, custom stickers, remixing, Live Rooms, Live Archive and channels that support text, video, voice and collaborators.

Sources:
- https://creators.instagram.com/formats-and-tools
- https://creators.instagram.com/blog/new-updates-to-content-creation-tools
- https://creators.instagram.com/live
- https://creators.instagram.com/create/broadcast-channels

### WhatsApp

WhatsApp's durable advantage is trusted private communication. Communities organize related groups; Channels separate public updates from chats; Status supports temporary photo, video, voice and text; private messages and calls remain end-to-end encrypted.

Sources:
- https://faq.whatsapp.com/495856382464992
- https://faq.whatsapp.com/1170535238421230
- https://blog.whatsapp.com/communities-now-available
- https://blog.whatsapp.com/introducing-whatsapp-channels-a-private-way-to-follow-what-matters

## Repository findings

### P0: fabricated behavior

- `Live.tsx` created a local session and local viewer count without a streaming backend.
- Co-host invitations used two hard-coded Unsplash identities and a timer.
- Chat, hearts, milestones and session discovery existed only in component memory.
- The Create editor previewed CSS filters, trim boundaries, crop and text but did not render those choices into the uploaded media.
- Background publishing navigated away before persistence and contained a client-URL fallback that could appear successful without durable media.

### P0: missing production systems

- No live ingest, SFU, transcoding, adaptive playback, stream keys, reconnection protocol or regional routing.
- No authoritative live-session directory, viewer presence, host controls or moderation queue.
- No durable object storage/CDN contract with malware/type inspection and lifecycle cleanup.
- No recommendation-service boundary, feature store, ranking telemetry or experiment framework.
- No complete trust-and-safety pipeline for reports, blocks, appeals, age gates or live review.

### P1: product gaps

- Creation lacks a real non-destructive timeline, persisted drafts, audio rights, captions, cover selection and background rendering.
- Discovery lacks explicit ranking objectives, diversity controls, cold-start handling and user controls.
- Messaging lacks a single documented privacy/encryption model and resilient attachment delivery.
- Creator analytics, monetization, subscriptions and payout safety are not productized.

## Differentiated Omni experience

1. **Moments** — short and long video in one continuous, accessible viewer with transparent “Why this?” controls.
2. **Circles** — opt-in communities that bind feed, scheduled live rooms, durable chat and shared collections.
3. **Threads that travel** — a post can become a focused group conversation or a live room without copying content into disconnected surfaces.
4. **Creator-owned context** — credits, sources, collaborators, chapters and updates remain attached to the work.
5. **Low-bandwidth excellence** — resumable upload, adaptive download, offline drafts and data-saver defaults designed for interrupted mobile networks.
6. **Trust as a feature** — clear audience controls, visible moderation status, block/report everywhere, age-aware defaults and no fabricated engagement.

## Delivery sequence

### Phase 0 — truth and reliability

- Remove mock people, engagement, success states and unsupported editor controls.
- Make publish completion depend on durable media plus persisted post metadata.
- Add typed API errors, cancellation, retry policy, idempotency keys and observability.

### Phase 1 — creator core

- Add resumable object-storage uploads, server-side media probing and transcode jobs.
- Build a real timeline editor using an explicit render manifest; preview and exported media must match.
- Persist private drafts, covers, captions, audience, comments, credits and accessibility metadata.

### Phase 2 — discovery and community

- Separate candidate generation, ranking and policy filtering.
- Instrument impressions, watch time, completion, skips, hides, follows and negative feedback.
- Launch Circles with roles, invite links, announcements, events and scoped moderation.

### Phase 3 — production live

- WebRTC ingest to a managed or self-hosted SFU; adaptive HLS/LL-HLS playback.
- Authoritative sessions, presence, chat, co-host requests, moderation and replay archive.
- Network handoff, reconnect, latency and quality telemetry; staged regional load tests.

### Phase 4 — sustainable creator economy

- Subscriptions, ticketed rooms, gifts and revenue share only after fraud controls, ledgers, refunds, taxes, age gates and payout operations are ready.

## Pull-request scope

This foundation PR intentionally does two things first:

1. Replaces the Create route with an honest persistence-gated upload flow.
2. Removes the simulated Live experience and replaces it with device preflight plus a production-readiness gate.

It does **not** claim that Omni Live is complete. Shipping a simulated broadcast would damage user trust and hide the infrastructure work required for a competitive product.
