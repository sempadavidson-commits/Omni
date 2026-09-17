# Omni architecture audit

## Executive assessment

Omni has a credible full-stack skeleton—React 19, Express, Firebase Authentication, PostgreSQL/Drizzle, local-first queues, PWA support, chunked uploads, and an SSE channel—but the repository was not production-safe as received. The highest risks were an authentication bypass, 2 GB global request parsing, false-success account/event paths, corruptible chunk uploads, and private message payloads broadcast over a global unauthenticated stream.

This pass fixes the identified P0/P1 paths and establishes a quieter, more human visual system. It does not claim every large feature module is fully remediated; several files exceed 35–60 KB and require bounded follow-up work with integration infrastructure.

## Remediated
- Removed acceptance of decoded-but-unverified JWT payloads and arbitrary local strings as authenticated identities.
- Reduced global JSON parsing from 2 GB to 1 MB and URL-encoded parsing to 256 KB.
- Added baseline response hardening and bounded media/chunk validation.
- Stopped broadcasting private message contents on the global SSE stream.
- Made verified Firebase identity authoritative for events.
- Replaced fake registration/event success paths with explicit failures.
- Enforced ordered, bounded chunk uploads and safe stored extensions.
- Reworked the visual foundation with warm graphite, off-white, muted blue, and restrained coral.
- Improved touch targets, focus visibility, reduced-motion behavior, splash branding, and crash recovery.

## Remaining priorities
1. User-scope and authenticate realtime subscriptions.
2. Move media to durable object storage with signed access, inspection, lifecycle policy, and CDN delivery.
3. Add server-side file-signature detection, rate limiting, abuse controls, and structured security logs.
4. Make like/comment/repost counters transactionally conditional on unique relationship changes.
5. Remove remaining silent catches and false-empty responses.
6. Replace `any` API boundaries with runtime-validated contracts.
7. Split oversized feature modules after characterization tests.
8. Add route-level lazy loading, bounded caches, upload checksums, and real Not Found/Settings screens.

## Verification status
Static assertions confirm removal of the known auth bypass, 2 GB parser, fake account fallback, and private message SSE broadcast. Full dependency installation, typecheck, and build could not run because the sandbox had no DNS access to npm and the archive did not include dependencies. Firebase, PostgreSQL, object storage, and authenticated browser journeys remain to be verified in a networked environment.

Run `npm install`, `npm run lint`, and `npm run build`, then test: boot, feed, playback, swipe, like, follow, comment, save/share, profile, search, inbox, messages, create, interrupted/resumed upload, publish, pin, refresh, delete, sign-out/sign-in, and persistence across owner/authorized/unauthorized roles.
