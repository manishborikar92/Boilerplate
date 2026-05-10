# Cloudflare Media Infrastructure — Production Architecture Research
## Photo Storage, Video Storage, Streaming, CDN Delivery & Secure Access

**Prepared:** May 2026  
**Stack:** Flutter (Android + iOS) · Node.js + Express.js  
**Exchange Rate:** 1 USD = ₹94.15 *(May 7, 2026 — verified via Trading Economics, Wise, BookMyForex)*  
**Pricing Verified:** Cloudflare official documentation (May 2026)  
**Classification:** Staff+ Engineering Reference — Production Architecture Blueprint

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Storage Architecture](#3-storage-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Edge & CDN Architecture](#6-edge--cdn-architecture)
7. [Video Processing Architecture](#7-video-processing-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Scalability Architecture](#9-scalability-architecture)
10. [Cost Optimization](#10-cost-optimization)
11. [Failure Scenarios & Recovery](#11-failure-scenarios--recovery)
12. [Production Best Practices](#12-production-best-practices)
13. [Provider Comparison](#13-provider-comparison)
14. [Pricing Reference](#14-pricing-reference)

---

## 1. Executive Summary

### 1.1 Architecture Philosophy

This architecture is built on four foundational principles:

**1. Edge-first delivery.** Every byte of media content is served from Cloudflare's 330+ global Points of Presence. The origin (R2) is never directly in the hot path for read traffic. Authentication, authorization, and cache orchestration happen at the edge, not the backend.

**2. Backend is an orchestrator, never a conduit.** The Node.js backend issues presigned URLs, validates identities, manages metadata, and coordinates async work. It never touches binary media data in the request path. No upload proxying. No streaming proxying. No image serving.

**3. Event-driven processing.** Video transcoding, thumbnail generation, push notifications, and status updates are all asynchronous, queue-driven, and idempotent. No synchronous processing blocks user-facing requests. Dead-letter queues and retry logic make every pipeline failure recoverable.

**4. Zero-egress cost foundation.** Cloudflare R2's zero egress fee fundamentally changes the economics of media delivery. It eliminates the largest cost driver in every competing architecture. Every design decision that preserves high CDN cache-hit rates multiplies this advantage.

### 1.2 Core Recommendation

| Decision | Chosen | Rationale |
|---|---|---|
| Photo & video storage | Cloudflare R2 | Zero egress, S3-compatible, ₹1.41/GB/month |
| Image optimization | Cloudflare Images (R2-origin transform-only mode) | On-demand WebP/AVIF without storage duplication |
| Video streaming | Pre-transcoded HLS via R2 + Worker | 17–82× cheaper than Cloudflare Stream at any scale |
| Video transcoding | ffmpeg on autoscaling containers + BullMQ queue | Queue-isolated, independently scalable, no per-view cost |
| Edge auth & delivery | Cloudflare Workers with HMAC-SHA256 tokens | Validates at 330+ PoPs, CDN-cacheable responses |
| CDN | Cloudflare CDN (automatic via Workers) | 330+ PoPs, free bandwidth, no configuration cost |
| Upload method | Direct presigned PUT to R2 | Zero backend bandwidth, linear client → R2 path |
| Video status updates | Server-Sent Events (SSE) / push notifications | Event-driven; eliminates polling anti-pattern |
| Bucket access | All buckets private, Worker-gated | Consistent security model, prevents hotlinking |
| Live streaming | Cloudflare Stream (only if required) | Only justifiable for actual RTMP/SRT live ingestion |

### 1.3 Why Not Cloudflare Stream

Cloudflare Stream charges $5.00/1,000 stored minutes and $1.00/1,000 delivered minutes. For a VOD application at 1,000 creators with 4.5 videos averaging 5 minutes each:

- **Stream cost:** ~₹52,960/month
- **R2 + HLS cost:** ~₹1,823–₹3,073/month
- **Cost ratio:** 17–29× more expensive

Stream is the correct choice only if: live RTMP/SRT streaming is a product requirement; the engineering team cannot maintain a transcoding pipeline; or total stored video is under 20 hours (Stream's minimum $5/month purchase covers this trivially). For all VOD scenarios described in this document, R2 + HLS is objectively correct.

### 1.4 Key Anti-Patterns Corrected in This Document

The following patterns commonly appear in early-stage media architectures and are explicitly replaced:

| Anti-Pattern | Correct Pattern |
|---|---|
| Backend proxies video uploads | Presigned direct upload to R2 |
| Backend streams video bytes | Edge delivery via Cloudflare Workers + R2 |
| Raw MP4 served directly as primary format | Pre-transcoded HLS with adaptive bitrate |
| Frontend polls `/status` endpoint for transcoding state | SSE or push notification on completion |
| Presigned GET URLs for video streaming | HMAC Worker tokens (CDN-cacheable, revocable) |
| Single VPS assumed sufficient for transcoding at scale | Queue-driven autoscaling container workers |
| Public R2 buckets for "public" content | All buckets private, Worker-gated with token auth |
| Token comparison with `===` operator | `timingSafeEqual` for all HMAC comparisons |
| Full CDN URLs stored in database | R2 object keys stored; URLs constructed at query time |
| IP address binding for mobile auth tokens | User-agent + userId binding (IPs change on mobile) |

---

## 2. System Architecture

### 2.1 High-Level System Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUTTER APP (Client)                            │
│                    Android & iOS — HTTP/2, TLS 1.3                      │
│                                                                          │
│  Upload State Machine    Playback Engine    Image Renderer              │
│  (Multipart + Resume)    (BetterPlayer HLS) (CachedNetworkImage)        │
└───────────┬──────────────────────────────────────────────┬──────────────┘
            │ API calls (JWT Bearer)                       │ Media requests (HMAC token)
            │                                              │
            ▼                                              ▼
┌───────────────────────────┐          ┌──────────────────────────────────────┐
│   NODE.JS + EXPRESS API   │          │       CLOUDFLARE EDGE NETWORK        │
│   (Auth + Orchestration)  │          │       330+ Global PoPs               │
│                           │          │                                       │
│  ┌─────────────────────┐  │          │   ┌──────────────────────────────┐   │
│  │ JWT Auth Middleware  │  │          │   │    Cloudflare Worker         │   │
│  │ Presigned URL Gen   │  │          │   │    ├── HMAC token validation  │   │
│  │ Metadata CRUD       │  │          │   │    ├── Cache key mgmt         │   │
│  │ SSE event push      │  │          │   │    ├── Range request proxy    │   │
│  │ BullMQ producer     │  │          │   │    ├── CORS + security hdrs   │   │
│  │ Webhook handler     │  │          │   │    └── KV blacklist check     │   │
│  └─────────────────────┘  │          │   └──────────────┬───────────────┘   │
└───────────┬───────────────┘          │                  │                   │
            │                          │   ┌──────────────▼───────────────┐   │
            │ S3-compatible API        │   │    Cloudflare CDN Edge Cache  │   │
            ▼                          │   │    Images: 30-day TTL         │   │
┌───────────────────────────┐          │   │    Segments (.ts): 24h TTL    │   │
│    CLOUDFLARE R2          │◄─────────┤   │    HLS playlists: 5min TTL    │   │
│    (All Buckets Private)  │          │   └──────────────────────────────┘   │
│                           │          └──────────────────────────────────────┘
│  media-images-prod/       │
│  media-videos-prod/       │          ┌──────────────────────────────────────┐
│  └── raw/{id}.mp4         │          │    CLOUDFLARE IMAGES                 │
│  └── hls/{id}/*.m3u8      │◄─────────│    On-demand WebP/AVIF transforms    │
│  └── hls/{id}/*.ts        │          │    R2-origin mode (no storage fee)   │
│  └── thumbnails/{id}/*.jpg│          └──────────────────────────────────────┘
└───────────────────────────┘
            ▲
            │ Download raw / Upload HLS
            ▼
┌───────────────────────────┐          ┌──────────────────────────────────────┐
│   TRANSCODING SERVICE     │          │    WORKERS KV                        │
│   (Docker + BullMQ)       │          │    Token blacklist (logout/revoke)   │
│   ffmpeg pipeline         │◄─────────│    Idempotency keys                  │
│   Auto-scaling workers    │          │    Distributed lock state            │
│   Dead-letter queue       │          └──────────────────────────────────────┘
└───────────────────────────┘
            │ Status update
            ▼
┌───────────────────────────┐
│   MONGODB                 │
│   R2 object keys          │
│   Video status + metadata │
│   BlurHash strings        │
│   User storage quotas     │
└───────────────────────────┘
```

### 2.2 Component Responsibility Matrix

| Component | Owns | Never Does |
|---|---|---|
| Flutter Client | Upload state machine, playback, UI state | Transcoding, auth validation, token signing |
| Node.js API | Auth, presigned URL gen, metadata, queue orchestration | Proxy binary data, stream video, transcode |
| Cloudflare Worker | HMAC validation, cache orchestration, range proxying | Business logic, DB queries, user management |
| Cloudflare CDN | Edge caching, global delivery, DDoS protection | Auth, transcoding, metadata |
| Cloudflare R2 | Binary asset storage, durability | CDN decisions, auth, metadata |
| Transcoding Workers | ffmpeg execution, HLS generation, thumbnail extraction | API serving, auth, metadata queries |
| MongoDB | Metadata persistence, status tracking, quotas | Binary storage, CDN routing |

### 2.3 Upload Pipeline

```
PHOTO UPLOAD:
─────────────
① Flutter: compress to 85% JPEG ≤ 2048px, detect MIME via magic bytes
② Flutter → POST /api/media/upload-url { contentType, sizeBytes, type }
③ Backend: validate JWT → check quota → generate UUID → create DB record (status=pending)
         → PutObjectCommand presigned URL (TTL=15min, Content-Type locked)
         → return { uploadUrl, mediaId, expiresAt }
④ Flutter → PUT {presigned_url} R2 directly (Content-Type: image/jpeg, binary body)
   Flutter tracks progress on PUT via dio progress callback
⑤ Flutter → POST /api/media/confirm { mediaId }
⑥ Backend: HeadObject on R2 key → verify Content-Type + magic bytes → update DB (status=ready)
         → construct CDN URL → return { cdnUrl, blurhash }
⑦ CDN URL: https://media.domain.com/images/{userId}/{uuid}?token={hmac}

VIDEO UPLOAD (MULTIPART):
──────────────────────────
① Flutter: compress to max 1080p/5Mbps via flutter_video_compress (optional)
② Flutter → POST /api/media/video/initiate { sizeBytes, contentType, duration }
③ Backend: validate JWT → check quota → generate videoId → CreateMultipartUpload on R2
         → generate presigned part URLs (10 parts × 50MB each, TTL=15min each)
         → create DB record (status=uploading, multipart_upload_id stored)
         → return { videoId, uploadId, parts: [{partNumber, uploadUrl}] }
④ Flutter: upload parts in parallel (concurrency=3), collect ETag per part
   store {uploadId, completedParts} in Flutter SecureStorage for resume capability
⑤ Flutter → POST /api/media/video/complete { videoId, uploadId, parts: [{partNumber, etag}] }
⑥ Backend: CompleteMultipartUpload on R2 → update DB (status=processing)
         → publish job to BullMQ queue → return { videoId, status:"processing" }
⑦ BullMQ Worker → ffmpeg pipeline (see Section 7)
⑧ On completion: webhook → backend updates DB (status=ready) → SSE push to Flutter → push notification
```

### 2.4 Video Delivery Pipeline

```
VIDEO PLAYBACK (GATED):
───────────────────────
① Flutter → POST /api/media/video/{id}/stream-token  [Bearer JWT]
② Backend: validate JWT → check access rights (ownership/subscription)
         → generate HMAC-SHA256 token { userId, videoId, exp: now+1h, iat }
         → return { token, expiresAt, hlsMasterUrl }
③ Flutter: construct URL: https://media.domain.com/v/{videoId}/master.m3u8?token={token}
         BetterPlayer loads master playlist
④ Request → Cloudflare CDN → cache HIT → serve immediately (0 R2 ops)
            cache MISS → Cloudflare Worker
⑤ Worker:
   a. Extract token from ?token= query parameter
   b. Check Workers KV blacklist → reject if blacklisted
   c. Verify HMAC-SHA256 signature (timingSafeEqual)
   d. Verify exp timestamp
   e. Strip token from cache key: cf.cacheKey = {protocol}://{hostname}{pathname}
   f. Check Cloudflare CDN cache using stripped key
   g. Cache HIT → return cached response
   h. Cache MISS → fetch from R2 (master.m3u8 or segment.ts)
   i. Set Cache-Control headers (playlists: max-age=300; segments: max-age=86400, immutable)
   j. Populate Cloudflare CDN cache with stripped cache key
   k. Return response to BetterPlayer
⑥ BetterPlayer: parse master.m3u8 → measure bandwidth → select rendition (720p or 480p)
   → fetch rendition playlist (.m3u8) → fetch segments (.ts) sequentially ahead of playhead
⑦ Segment requests hit CDN edge; after first viewer per PoP, all subsequent requests = cache hit
   Auth token validated at edge for every playlist request; segments served from CDN post-auth
⑧ At ~50 minutes (before 1h token expiry), Flutter silently calls /api/media/video/{id}/stream-token
   → receives new token → BetterPlayer reinitializes with new URL (seamless to user)
```

---

## 3. Storage Architecture

### 3.1 Bucket Strategy

Use two private R2 buckets with independent lifecycle policies and access patterns. Never mix images and videos in the same bucket — it prevents per-type lifecycle rules and complicates access pattern analysis.

```
R2 Account
├── media-images-prod           (Standard class, all private, CORS: app domain only)
│   ├── users/{userId}/avatars/{uuid}.jpg
│   ├── users/{userId}/covers/{uuid}.jpg
│   ├── posts/{postId}/{uuid}.jpg
│   └── thumbnails/videos/{videoId}/thumb_lg.jpg
│
└── media-videos-prod           (Standard class, all private)
    ├── raw/{videoId}.mp4           ← Deleted after successful transcoding
    └── hls/{videoId}/
        ├── master.m3u8
        ├── 720p.m3u8
        ├── 480p.m3u8
        └── segments/
            ├── 720p_0000.ts        ← 4-second segments
            ├── 720p_0001.ts
            ├── 480p_0000.ts
            └── 480p_0001.ts
```

**Critical: All buckets are private.** No `r2.dev` subdomain in production. No public access. Public "read" access to content is gated by the Cloudflare Worker which validates a token per request. This is not security theater — it prevents hotlinking, automated scraping, content theft, and provides a complete audit trail for every asset access.

**Additional buckets for operational isolation:**

| Bucket | Purpose | Access |
|---|---|---|
| `media-images-prod` | Production images | Worker-gated |
| `media-videos-prod` | Production video HLS + raw | Worker-gated |
| `media-images-staging` | Staging/test images | Worker-gated (separate Worker) |
| `media-videos-staging` | Staging/test videos | Worker-gated (separate Worker) |

Never use a production bucket for development or testing. Environment isolation at the bucket level prevents test content from incurring production lifecycle costs and eliminates cross-contamination of access logs.

### 3.2 Object Key Design

Object keys follow a deterministic, UUID-based scheme. Every key is generated by the backend — never by the client.

```
Images:
users/{userId}/avatars/{uuid}.jpg
users/{userId}/covers/{uuid}.jpg
posts/{postId}/{uuid}.jpg

Video thumbnails:
thumbnails/videos/{videoId}/thumb_lg.jpg    (1280×720, JPEG, ~200KB)
thumbnails/videos/{videoId}/thumb_sm.jpg    (640×360, JPEG, ~60KB)
thumbnails/videos/{videoId}/preview.webp    (480×270, animated WebP, 3s loop)

Video content:
raw/{videoId}.mp4                            (deleted after transcoding)
hls/{videoId}/master.m3u8
hls/{videoId}/720p.m3u8
hls/{videoId}/480p.m3u8
hls/{videoId}/segments/720p_{seq4}.ts       (seq4 = 4-digit zero-padded sequence)
hls/{videoId}/segments/480p_{seq4}.ts
```

**Key design principles:**

- Keys never contain PII (names, emails, phone numbers) — use opaque UUIDs
- Keys are path-structured with `/` separators for logical grouping (R2 treats these as prefixes, not directories)
- Keys are immutable — updating content means writing a new key and updating the DB pointer. Never overwrite an existing key for updated content (cache invalidation is expensive and unreliable)
- The database stores only the R2 object key string, never the full CDN URL. CDN URLs are constructed at query time by a URL helper module. If the CDN domain, Worker route, or URL structure changes, one config change propagates to all responses with no data migration

### 3.3 Storage Class Lifecycle

| Content | Class | Transition Rule | Rationale |
|---|---|---|---|
| Active HLS segments (< 90 days old) | Standard | — | Frequently served on CDN cache miss |
| Active images (< 90 days old) | Standard | — | Frequently served |
| HLS segments (> 90 days old) | Infrequent Access | After 90 days | ~33% cost reduction; CDN cache absorbs most reads |
| Image archives (> 90 days old) | Infrequent Access | After 90 days | ~33% cost reduction |
| Raw MP4 originals | Standard → Delete | Delete after confirmed HLS | No ongoing value; saves 40% of video storage |
| Soft-deleted content | Standard → Hard delete | 30-day grace period, then hard-delete | Storage cost accrues silently without cleanup |

**IA tier caveat:** R2 Infrequent Access has a 30-day minimum storage duration. Objects deleted before 30 days are still billed for the full 30 days. Apply IA only to objects that will genuinely remain for 30+ days. Raw MP4 files (deleted quickly after transcoding) should never be moved to IA.

**IA Class A operations note:** IA tier Class A operations (PUTs) cost $9.00/million — double the Standard rate ($4.50/million). Factor this into lifecycle automation if you are moving large numbers of objects programmatically.

### 3.4 Multipart Upload Lifecycle Cleanup

Incomplete multipart uploads bill for the storage of uploaded parts even if never completed. Without cleanup, abandoned uploads from crashed clients or poor connections accumulate silently. Set a lifecycle rule to abort incomplete multipart uploads after 7 days:

```javascript
// Set via R2 S3-compatible API at bucket provisioning time
const lifecycleConfig = {
  Rules: [{
    ID: 'abort-incomplete-multipart',
    Status: 'Enabled',
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 }
  }]
};
await s3Client.send(new PutBucketLifecycleConfigurationCommand({
  Bucket: 'media-videos-prod',
  LifecycleConfiguration: lifecycleConfig
}));
```

### 3.5 Object Metadata Schema

Store the following in the database — never in R2 object metadata (R2 metadata is not queryable):

**`media` collection (images):**
```javascript
// Mongoose schema — media collection
const mediaSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:        { type: String, required: true },   // 'avatar' | 'cover' | 'post_image' | 'video_thumbnail'
  status:      { type: String, required: true },   // 'pending' | 'ready' | 'failed' | 'deleted'
  r2Key:       { type: String, required: true },   // R2 object key — single source of truth for storage location
  r2Bucket:    { type: String, required: true },
  contentType: { type: String, required: true },
  fileSize:    { type: Number },                   // Bytes — set from HeadObject after upload confirmation
  width:       { type: Number },
  height:      { type: Number },
  blurhash:    { type: String },                   // BlurHash compact placeholder for loading UX
}, { timestamps: true });

mediaSchema.index({ userId: 1, status: 1 });
```

**`videos` collection:**
```javascript
// Mongoose schema — videos collection
const videoSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:              { type: String, maxlength: 255 },
  status:             { type: String, required: true },  // 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted'
  rawR2Key:           { type: String },                  // Nulled after transcoding + deletion
  hlsR2Prefix:        { type: String },                  // e.g., 'hls/{videoId}/'
  thumbnailR2Key:     { type: String },                  // Large thumbnail key
  thumbnailBlurhash:  { type: String },                  // BlurHash for thumbnail loading UX
  durationSeconds:    { type: Number },
  fileSizeBytes:      { type: Number },
  hlsQualities:       { type: [Object], default: [] },   // [{"label":"720p","bandwidth":2928000,"resolution":"1280x720"}]
  multipartUploadId:  { type: String },                  // Cleared on completion; used for resume
  transcodeJobId:     { type: String },                  // BullMQ job ID for monitoring
  transcodeStartedAt: { type: Date },
  transcodeError:     { type: String },                  // Populated on failure for diagnostics
  isPublic:           { type: Boolean, default: false },
  viewCount:          { type: Number, default: 0 },
}, { timestamps: true });

videoSchema.index({ userId: 1, status: 1 });
videoSchema.index({ status: 1, createdAt: -1 });
```

---

## 4. Frontend Architecture

### 4.1 Flutter Package Selection

| Package | Purpose | Why This Choice |
|---|---|---|
| `dio` | HTTP client, upload, interceptors | Progress callbacks on PUT, interceptor for JWT refresh, multipart support |
| `better_player` | HLS video playback | Native HLS ABR quality switching, configurable buffering, built-in caching |
| `cached_network_image` | Image loading with caching | Disk + memory cache, BlurHash placeholder support, retry on failure |
| `flutter_image_compress` | Pre-upload JPEG compression | Reduces upload size and R2 storage cost before upload |
| `image_picker` | Camera + gallery selection | Cross-platform media selection |
| `flutter_secure_storage` | Store upload state (resume) | Encrypted local storage for upload IDs and part ETags |
| `path_provider` | Local file paths | Platform-appropriate temp directories |
| `mime` | MIME type detection | Detect actual MIME from file bytes, not extension |
| `blurhash` | BlurHash decoding | Decode stored BlurHash string to placeholder image |
| `firebase_messaging` | Push notifications | Transcoding completion notifications |

**On `better_player` vs `video_player`:** The official `video_player` package supports HLS on both platforms but lacks ABR quality selection visibility, buffering configuration, and built-in cache management. `better_player` wraps ExoPlayer (Android) and AVPlayer (iOS) with a production-grade control layer, adaptive quality reporting, and native HLS ABR — the correct choice for any application serving HLS content.

### 4.2 Image Upload State Machine

```
States: IDLE → COMPRESSING → REQUESTING_URL → UPLOADING → CONFIRMING → READY
                                                    ↕
                                               UPLOAD_FAILED
                                                    ↕
                                          RETRYING (exponential backoff)
                                              ↓ (after max retries)
                                           FAILED

Transitions:
IDLE → COMPRESSING          : User selects image
COMPRESSING → REQUESTING_URL: Compression complete
REQUESTING_URL → UPLOADING  : Presigned URL received
UPLOADING → CONFIRMING      : PUT request 2xx received
CONFIRMING → READY          : Backend confirm returns cdnUrl
UPLOADING → UPLOAD_FAILED   : PUT request fails / timeout
UPLOAD_FAILED → REQUESTING_URL: Token expired (403) → re-request URL for same UUID
UPLOAD_FAILED → UPLOADING   : Same URL valid → retry PUT
```

**Key implementation detail:** When a PUT to a presigned URL returns 403 with "Request has expired" in the body, the Flutter client must call `POST /api/media/upload-url` again. The backend re-issues a new presigned URL for the same UUID and object key — the new PUT is idempotent; it overwrites any partial data. The DB record stays in `pending` status until `confirm` is called.

### 4.3 Video Upload State Machine

```dart
// Upload state model — persist to flutter_secure_storage for resume
class VideoUploadState {
  final String videoId;           // Backend-assigned UUID
  final String uploadId;          // R2 multipart upload ID
  final List<UploadPart> parts;   // {partNumber, uploadUrl, etag?, status}
  final int totalParts;
  final UploadStatus status;      // uploading | paused | completed | failed

  // Persisted to survive app termination:
  // - videoId → lookup DB record on resume
  // - uploadId → resume with same R2 multipart upload
  // - completedParts (partNumber + etag) → skip on resume
}
```

**Multipart upload flow detail:**

```
1. POST /api/media/video/initiate → { videoId, uploadId, parts: [{partNumber, uploadUrl}] }
   Backend creates 10-50 presigned part URLs, TTL=15min each
   
2. Upload parts in parallel (concurrency = 3 on mobile, 5 on WiFi)
   For each part:
     → PUT {partUploadUrl} [binary chunk]
     → collect ETag from response header X-Amz-ETag
     → store {partNumber, etag} in flutter_secure_storage
     
3. If any part fails:
     → exponential backoff: 2s, 4s, 8s, 16s
     → if 403 (URL expired): call POST /api/media/video/part-url/{videoId}/{partNumber}
       Backend re-issues a presigned URL for that part only (same uploadId)
     → retry with new URL
     
4. All parts complete:
   POST /api/media/video/complete { videoId, uploadId, parts: [{partNumber, etag}] }
   
5. App backgrounded mid-upload:
   → Upload pauses; state persisted to flutter_secure_storage
   → On app resume: load state → identify incomplete parts → resume from those parts
   → Parts with valid ETags are skipped; only pending parts are re-uploaded
```

**Android-specific:** Register a WorkManager task to continue the upload even when the app is fully backgrounded. This is essential for large videos on mobile connections where the foreground upload would otherwise be killed by the OS.

### 4.4 Video Playback Architecture

```dart
// BetterPlayer configuration for HLS playback
BetterPlayerConfiguration(
  autoPlay: false,
  looping: false,
  fit: BoxFit.contain,
  controlsConfiguration: BetterPlayerControlsConfiguration(
    enableFullscreen: true,
    enableSubtitles: false,
    enableQualities: true,  // Show quality selector to user
  ),
  buffering: BetterPlayerBufferingConfiguration(
    minBufferMs: 2000,       // Min 2s buffer before playback starts
    maxBufferMs: 30000,      // Buffer up to 30s ahead
    bufferForPlaybackMs: 1000,
    bufferForPlaybackAfterRebufferMs: 2000,
  ),
  cacheConfiguration: BetterPlayerCacheConfiguration(
    useCache: true,
    maxCacheSize: 200 * 1024 * 1024,   // 200MB disk cache
    maxCacheFileSize: 20 * 1024 * 1024, // 20MB per file
  ),
)
```

**Token refresh strategy:** Issue media tokens with a 1-hour TTL. At 50 minutes (10 minutes before expiry), silently call `POST /api/media/video/{id}/stream-token` in the background. Update BetterPlayer's data source URL with the new token. The player does not restart — only subsequent segment requests use the new token. This is invisible to the user.

**Pre-loading strategy:** When a video enters within 2 items of the viewport in a scroll list (e.g., a feed), pre-fetch the master playlist and first 2 segments in a background isolate. This eliminates startup latency when the user taps play.

### 4.5 Image Display Architecture

```dart
// CachedNetworkImage with BlurHash placeholder
CachedNetworkImage(
  imageUrl: cdnUrl,              // Constructed from API response (includes HMAC token)
  cacheKey: mediaId,             // Cache by stable media ID, not URL (URL includes expiring token)
  placeholder: (ctx, url) => BlurHashImage(blurhash: mediaItem.blurhash),
  errorWidget: (ctx, url, err) => Icon(Icons.broken_image),
  httpHeaders: {},               // HMAC token is in the URL query param, not headers
  memCacheWidth: displayWidth * devicePixelRatio.toInt(),
  fadeInDuration: Duration(milliseconds: 200),
)
```

**BlurHash vs LQIP:** BlurHash is superior to base64 LQIP (Low Quality Image Placeholder) for this architecture. A BlurHash string is 20–30 characters (vs 500–2000 bytes for a base64 20×20 JPEG), renders as a gradient placeholder without a network request, and is decoded on the GPU in Flutter. Store the BlurHash in the database, not the R2 key — it is metadata, not content.

**CDN URL construction:** Never store the full CDN URL in the database. Construct it at query time:

```javascript
// Node.js media URL helper — single point of truth
function buildMediaUrl(r2Key, options = {}) {
  const { token, variant, expiresAt } = options;
  let url = `${process.env.CDN_BASE_URL}/${r2Key}`;
  const params = new URLSearchParams();
  if (variant) params.set('variant', variant);
  if (token) params.set('token', token);
  if (params.size > 0) url += `?${params.toString()}`;
  return { url, expiresAt };
}
```

### 4.6 Mobile Lifecycle Edge Cases

| Scenario | Behavior | Implementation |
|---|---|---|
| App backgrounded during upload | Upload pauses; state persisted | WorkManager task (Android); BackgroundTasks framework (iOS) |
| Network switches mid-upload (WiFi → 4G) | Current part fails; retry on new network | ConnectivityStream listener triggers upload resume |
| Low memory during upload | Part ETags persisted to disk before OOM | Write to flutter_secure_storage after each part completes |
| App crash during upload | Resume from last completed part on next open | Load state from flutter_secure_storage on app init; check for in-progress uploads |
| Token expires while video is playing | Seamless token refresh at 50-min mark | Background silent refresh; BetterPlayer URL updated without restart |
| Presigned URL expires before upload starts | Re-request URL for same videoId | 403 detection → call `/api/media/video/part-url` endpoint |
| Video enters background after first few segments | Buffer drains slowly on iOS (AVPlayer limits) | Set `AVAudioSession` to allow background audio; mitigates iOS background playback restrictions |

---

## 5. Backend Architecture

### 5.1 API Route Design

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/media/image/upload-url` | JWT | Generate presigned PUT URL for image |
| POST | `/api/media/image/confirm` | JWT | Mark image upload complete, return CDN URL |
| GET | `/api/media/image/:id` | JWT | Return image metadata + CDN URL |
| DELETE | `/api/media/image/:id` | JWT | Soft-delete image, schedule R2 deletion |
| POST | `/api/media/video/initiate` | JWT | Start multipart video upload |
| POST | `/api/media/video/part-url/:videoId/:partNumber` | JWT | Re-issue expired part URL |
| POST | `/api/media/video/complete` | JWT | Complete multipart, enqueue transcoding |
| GET | `/api/media/video/:id/status` | JWT | Current transcoding status (SSE endpoint) |
| POST | `/api/media/video/:id/stream-token` | JWT | Issue HMAC streaming token |
| DELETE | `/api/media/video/:id` | JWT | Delete video and all R2 assets |
| POST | `/internal/webhooks/transcode-complete` | Shared secret | Transcoding worker completion callback |
| POST | `/internal/webhooks/transcode-failed` | Shared secret | Transcoding worker failure callback |

### 5.2 Presigned URL Generation

```javascript
// Node.js — R2 client setup (AWS SDK v3, S3-compatible)
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Generate presigned PUT URL for direct upload
async function generateUploadUrl({ userId, mediaId, contentType, sizeBytes }) {
  const key = `users/${userId}/images/${mediaId}.jpg`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.R2_IMAGES_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,  // Enforce exact file size — prevents oversized uploads
  });
  
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 }); // 15 minutes
  const expiresAt = new Date(Date.now() + 900_000).toISOString();
  
  return { uploadUrl, key, expiresAt };
}
```

**Critical: enforce `ContentLength`** in the PutObjectCommand. Without it, a malicious client can upload a file larger than declared (which passed your quota check). R2 will accept it; you'll be billed for the actual size.

**Post-upload validation:**

```javascript
// Called from POST /api/media/image/confirm
async function validateAndConfirmUpload(mediaId, r2Key, declaredContentType) {
  // HeadObject to verify actual content-type stored in R2
  const head = await r2.send(new HeadObjectCommand({
    Bucket: process.env.R2_IMAGES_BUCKET,
    Key: r2Key,
  }));
  
  // Verify MIME type matches what was declared
  if (head.ContentType !== declaredContentType) {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_IMAGES_BUCKET, Key: r2Key }));
    throw new Error('Content-Type mismatch — object deleted');
  }
  
  // Magic byte verification: download first 16 bytes
  const preview = await r2.send(new GetObjectCommand({
    Bucket: process.env.R2_IMAGES_BUCKET,
    Key: r2Key,
    Range: 'bytes=0-15',
  }));
  const bytes = Buffer.from(await preview.Body.transformToByteArray());
  
  if (!isValidImageMagicBytes(bytes, declaredContentType)) {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_IMAGES_BUCKET, Key: r2Key }));
    throw new Error('Magic byte mismatch — object deleted');
  }
  
  // Update DB: status=ready, actual file size from HeadObject
  await db.media.update({ id: mediaId }, {
    status: 'ready',
    fileSizeBytes: head.ContentLength,
  });
}

function isValidImageMagicBytes(bytes, contentType) {
  const SIGNATURES = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
  };
  return (SIGNATURES[contentType] || []).some(sig =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}
```

### 5.3 HMAC Media Token Generation

```javascript
import crypto from 'crypto';

// Token payload is authenticated — cannot be tampered without invalidating signature
function generateMediaToken({ userId, resourceId, resourceType }) {
  const payload = {
    sub: userId,
    rid: resourceId,
    rtype: resourceType,   // 'video' | 'image'
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,  // 1 hour TTL
  };
  
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');
  
  // HMAC-SHA256 — secret is a 256-bit random string stored in environment variables
  // Rotate every 30 days; maintain previous secret for TTL of issued tokens
  const sig = crypto
    .createHmac('sha256', process.env.MEDIA_TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  
  return `${encoded}.${sig}`;
}
```

**Secret rotation:** Maintain two active HMAC secrets simultaneously during rotation:
1. `MEDIA_TOKEN_SECRET` (current — used for signing new tokens)
2. `MEDIA_TOKEN_SECRET_PREV` (previous — still valid for tokens issued before rotation)

Both secrets are deployed to the Cloudflare Worker via `wrangler secret put`. The Worker tries verification with the current secret first, then falls back to the previous secret. After the previous secret's oldest issued token expires (1 hour), remove the previous secret from the Worker.

### 5.4 Transcoding Queue Architecture

```javascript
import { Queue, Worker, QueueEvents } from 'bullmq';

// Producer (Node.js API) — enqueues job on video upload completion
const transcodeQueue = new Queue('video:transcode', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },  // 1min, 2min, 4min backoff
    removeOnComplete: { age: 86400 },  // Keep completed jobs for 24h for debugging
    removeOnFail: false,               // Keep failed jobs in DLQ for manual inspection
  },
});

await transcodeQueue.add('transcode', {
  videoId,
  rawR2Key: `raw/${videoId}.mp4`,
  outputPrefix: `hls/${videoId}/`,
  qualities: ['720p', '480p'],
}, {
  jobId: videoId,  // Idempotency: same videoId = same job; prevents duplicate transcodes
});

// Dead-letter queue pattern: failed jobs remain in 'failed' queue
// Monitor queue depth and failed job count — alert if:
//   - Pending queue depth > 50: add transcoding capacity
//   - Failed jobs count > 5 in 1 hour: alert engineering immediately
```

### 5.5 Server-Sent Events for Transcoding Status

**Anti-pattern: polling.** Many architectures implement `GET /api/media/video/:id/status` which clients poll every 5–30 seconds. This is wasteful — it generates unnecessary DB queries and creates artificial latency between completion and notification. The correct pattern is push-based:

```javascript
// Node.js — SSE endpoint for transcoding status
app.get('/api/media/video/:id/status/stream', authenticate, async (req, res) => {
  const { id } = req.params;
  
  // Verify user owns this video
  const video = await db.videos.findOne({ id, userId: req.user.id });
  if (!video) return res.status(404).json({ error: 'Not found' });
  
  // If already ready, return immediately without SSE
  if (video.status === 'ready') {
    return res.json({ status: 'ready', hlsMasterUrl: buildMediaUrl(video.hlsR2Prefix + 'master.m3u8') });
  }
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Subscribe to Redis Pub/Sub channel for this video
  const channel = `video:status:${id}`;
  redisSubscriber.subscribe(channel, (message) => {
    const event = JSON.parse(message);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.status === 'ready' || event.status === 'failed') {
      redisSubscriber.unsubscribe(channel);
      res.end();
    }
  });
  
  // Heartbeat to keep connection alive through proxies
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    redisSubscriber.unsubscribe(channel);
  });
});

// Transcoding worker publishes to channel on completion/failure
// Webhook handler (called by transcoding VPS) also publishes
async function handleTranscodeComplete(videoId, { hlsPrefix, duration, thumbnailKey, blurhash }) {
  await db.videos.update({ id: videoId }, {
    status: 'ready',
    hlsR2Prefix: hlsPrefix,
    durationSeconds: duration,
    thumbnailR2Key: thumbnailKey,
    thumbnailBlurhash: blurhash,
    transcodedAt: new Date(),
  });
  
  // Publish to SSE channel
  await redisPublisher.publish(`video:status:${videoId}`, JSON.stringify({
    status: 'ready',
    duration,
    hlsMasterUrl: buildMediaUrl(`${hlsPrefix}master.m3u8`),
    thumbnailUrl: buildMediaUrl(thumbnailKey),
    blurhash,
  }));
  
  // Push notification for users who closed the app
  await sendPushNotification(userId, {
    title: 'Video ready',
    body: 'Your video has finished processing',
    data: { videoId, type: 'video_ready' },
  });
}
```

**Flutter SSE client:**

```dart
// Flutter — EventSource subscription for transcoding status
class VideoStatusStream {
  Stream<VideoStatusEvent> watch(String videoId) async* {
    final uri = Uri.parse('${Config.apiBase}/api/media/video/$videoId/status/stream');
    final client = http.Client();
    
    final request = http.Request('GET', uri)
      ..headers['Authorization'] = 'Bearer ${await tokenStore.getAccessToken()}'
      ..headers['Accept'] = 'text/event-stream';
    
    final response = await client.send(request);
    
    await for (final chunk in response.stream.transform(utf8.decoder)) {
      for (final line in chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          final event = VideoStatusEvent.fromJson(jsonDecode(line.substring(6)));
          yield event;
          if (event.isTerminal) { client.close(); return; }
        }
      }
    }
  }
}
```

### 5.6 RBAC and Access Control

```javascript
// Access control middleware — checks ownership + subscription gating
async function authorizeVideoAccess(req, res, next) {
  const { videoId } = req.params;
  const userId = req.user.id;
  
  const video = await db.videos.findOne({ id: videoId });
  if (!video || video.status === 'deleted') return res.status(404).json({ error: 'Not found' });
  
  // Owner always has access
  if (video.userId === userId) return next();
  
  // Public videos accessible to all authenticated users
  if (video.isPublic && video.status === 'ready') return next();
  
  // Subscription-gated content: check subscription
  if (video.isGated) {
    const sub = await db.subscriptions.findOne({ subscriberId: userId, creatorId: video.userId, active: true });
    if (!sub) return res.status(403).json({ error: 'Subscription required' });
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied' });
}
```

---

## 6. Edge & CDN Architecture

### 6.1 Cloudflare Worker Implementation

The Worker is the authentication and cache orchestration layer. It runs at 330+ Cloudflare PoPs — not in a single region. Token validation adds ~1–3ms on cache miss; zero overhead on cache hit (cached content is served before the Worker runs for subsequent requests).

```javascript
// Cloudflare Worker — media delivery with HMAC auth + cache key management
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Route: /v/* = video content (auth required)
    // Route: /images/* = image content (auth required)
    // Route: /public/* = thumbnails (no auth, but rate-limited)
    
    try {
      return await handleMediaRequest(request, url, env, ctx);
    } catch (err) {
      // passThroughOnException behavior for non-critical routes
      console.error(JSON.stringify({ event: 'worker_error', path: url.pathname, error: err.message }));
      return new Response('Internal error', { status: 500 });
    }
  }
};

async function handleMediaRequest(request, url, env, ctx) {
  // Step 1: Extract and validate HMAC token
  const token = url.searchParams.get('token');
  if (!token) return new Response('Unauthorized', { status: 401 });
  
  const payload = await verifyHmacToken(token, env.MEDIA_TOKEN_SECRET, env.MEDIA_TOKEN_SECRET_PREV);
  if (!payload) return new Response('Invalid or expired token', { status: 401 });
  
  // Step 2: Check KV blacklist (logout/revoke)
  const blacklisted = await env.TOKEN_BLACKLIST.get(`token:${token.split('.')[0]}`);
  if (blacklisted) return new Response('Token revoked', { status: 401 });
  
  // Step 3: Build cache key WITHOUT the token parameter
  // This is the critical optimization: all users share the same CDN cache entry
  const cacheKey = new Request(
    `${url.protocol}//${url.hostname}${url.pathname}`,  // Strip all query params
    { method: 'GET', headers: {} }
  );
  
  // Step 4: Check Cloudflare CDN cache
  const cache = caches.default;
  let cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    // Cache hit — auth has been validated, return cached content
    return cachedResponse;
  }
  
  // Step 5: Fetch from R2 — pass Range header for video seek support
  const r2Key = url.pathname.slice(1);  // Remove leading /
  const r2Object = await env.MEDIA_VIDEOS.get(r2Key, {
    range: request.headers.get('Range') ? parseRange(request.headers.get('Range')) : undefined,
  });
  
  if (!r2Object) return new Response('Not found', { status: 404 });
  
  // Step 6: Build response with correct headers
  const headers = new Headers();
  headers.set('Content-Type', r2Object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Accept-Ranges', 'bytes');
  
  // Immutable cache for segments; short TTL for playlists
  const isSegment = url.pathname.endsWith('.ts');
  const isPlaylist = url.pathname.endsWith('.m3u8');
  if (isSegment) {
    headers.set('Cache-Control', 'public, max-age=86400, immutable');
  } else if (isPlaylist) {
    headers.set('Cache-Control', 'public, max-age=300');
  }
  
  // Security headers on all responses
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'same-site');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  const status = request.headers.get('Range') ? 206 : 200;
  const response = new Response(r2Object.body, { status, headers });
  
  // Step 7: Populate CDN cache with the token-stripped key
  // Use ctx.waitUntil to not block the response
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  
  // Step 8: Structured audit log
  ctx.waitUntil(env.ANALYTICS.writeDataPoint({
    blobs: [url.pathname, payload.rtype, request.cf?.country || 'unknown'],
    doubles: [r2Object.size],
    indexes: [payload.sub],
  }));
  
  return response;
}

async function verifyHmacToken(token, secret, prevSecret) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [encodedPayload, providedSig] = parts;
  
  // Verify against current secret first, then previous (rotation support)
  for (const key of [secret, prevSecret].filter(Boolean)) {
    const expectedSig = await computeHmac(encodedPayload, key);
    
    // timingSafeEqual prevents timing attacks — NEVER use === for HMAC comparison
    const sigBuffer = new TextEncoder().encode(providedSig);
    const expectedBuffer = new TextEncoder().encode(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length) continue;
    
    const match = crypto.subtle.timingSafeEqual
      ? crypto.subtle.timingSafeEqual(sigBuffer, expectedBuffer)
      : timingSafeCompare(sigBuffer, expectedBuffer);
    
    if (!match) continue;
    
    // Signature valid — verify expiry
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;  // Expired
    
    return payload;
  }
  return null;
}
```

### 6.2 Cache Key Design

The token-stripping cache key pattern is the cornerstone of this architecture's CDN efficiency. Without it, every unique token generates a separate CDN cache entry — effectively zero cache hit rate for authenticated content.

```
Without token stripping:
URL: https://media.domain.com/v/{id}/720p_0001.ts?token=abc123
CDN cache key: full URL including token
Result: Each user's request = unique cache key = cache MISS = R2 read per user

With token stripping (this architecture):
URL: https://media.domain.com/v/{id}/720p_0001.ts?token=xyz789
CDN cache key: https://media.domain.com/v/{id}/720p_0001.ts
Result: First request per PoP = cache MISS = R2 read (1 op)
        Every subsequent request = cache HIT = zero R2 ops
```

**Why this is secure:** The token is validated by the Worker BEFORE the cache key is computed. Only valid, unexpired requests get served from cache. An invalid token receives a 401 before the Worker even attempts a cache lookup. The cache contains no protected content — it contains bytes that are only accessible after successful authentication.

### 6.3 Cache-Control Strategy

| Content Type | Cache-Control | TTL Logic |
|---|---|---|
| HLS segments (.ts) | `public, max-age=86400, immutable` | Immutable once transcoded; 24h is conservative (could be 1yr) |
| HLS master playlist (.m3u8) | `public, max-age=300` | Short TTL — rarely changes but must be correctable |
| HLS rendition playlists (.m3u8) | `public, max-age=300` | Same |
| Video thumbnails | `public, max-age=2592000, immutable` | 30 days — thumbnails never change after generation |
| Post/feed images | `public, max-age=86400` | 24h — covers most viewing sessions |
| User avatars | `public, max-age=604800` | 7 days — updated infrequently |
| Private/DM images | `private, no-store` | Never cache on shared CDN edge |
| API responses | `no-cache, no-store` | Never |

**Note on `immutable`:** The `immutable` directive tells browsers they need not revalidate the resource during its max-age window, even after navigating back. Combined with content-addressed keys (UUID-based), this is safe — the URL changes if content changes.

### 6.4 Cache Invalidation Strategy

R2 does not push invalidation events to Cloudflare CDN automatically. The architecture handles this through key rotation rather than cache purging:

- **Images:** Assign a new UUID when a user updates their avatar/cover. Update the DB pointer. The old CDN URL naturally expires at its Cache-Control TTL. For urgent removals (content moderation), use the Cloudflare Cache Purge API.
- **HLS segments:** Never updated. Transcoding always generates a new `{videoId}` prefix. No cache invalidation needed.
- **HLS playlists:** Short TTL (5 min) means stale playlists self-heal quickly without explicit purge.
- **Explicit purge:** `POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache` with specific URLs for content moderation removals, abuse reports, or DMCA takedowns.

### 6.5 Cloudflare Images Integration

For image optimization, use Cloudflare Images in transform-only mode — images are stored in R2, Cloudflare Images only performs transformation on demand:

```
Transform URL pattern:
https://media.domain.com/cdn-cgi/image/width=400,height=400,fit=cover,format=auto/images/{userId}/{uuid}.jpg

URL components:
- /cdn-cgi/image/{params}/ — Cloudflare Images transformation directive
- /images/{path} — R2 object path (fetched by Cloudflare Images as origin)
```

**Named variants approach (preferred for cachability):**

```javascript
// Define named variants in Cloudflare Images dashboard or API
const VARIANTS = {
  thumbnail: { width: 320, height: 180, fit: 'cover', format: 'auto', quality: 80 },
  preview:   { width: 800, quality: 82, format: 'auto' },
  avatar:    { width: 200, height: 200, fit: 'cover', format: 'auto', quality: 85 },
  full:      { width: 1200, quality: 88, format: 'auto' },
};
// Named variant URL: https://media.domain.com/images/{r2key}/thumbnail
// Named variants are billed once per unique {source + variant} combo, regardless of view count
```

**Cost breakeven:** At > 1 million unique transformations/month (~₹47,075/month), switch to a custom Worker-based image transform using the `sharp` npm package compiled to WASM. This eliminates transformation fees but requires ~1 week of engineering effort.

---

## 7. Video Processing Architecture

### 7.1 Transcoding Pipeline Overview

```
Event: POST /api/media/video/complete received
  │
  └─► BullMQ Queue: video:transcode
        Job payload: { videoId, rawR2Key, outputPrefix, qualities }
        Job options: attempts=3, exponential backoff 1min/2min/4min
        Concurrency: 1-2 per VPS instance (CPU-bound)
             │
             ▼
       ┌─────────────────────────────────────────────────────┐
       │   TRANSCODING WORKER PROCESS                         │
       │                                                      │
       │  1. Download raw MP4 from R2 via presigned GET URL   │
       │     (stream to disk — never fully buffer in memory)  │
       │                                                      │
       │  2. Validate input: ffprobe → check codec, duration  │
       │     Reject corrupt files before ffmpeg runs          │
       │                                                      │
       │  3. Run ffmpeg — HLS generation (see 7.2)            │
       │                                                      │
       │  4. Upload HLS files to R2                           │
       │     (master.m3u8, 720p.m3u8, 480p.m3u8, all .ts)    │
       │     Upload in parallel, 5 concurrent puts            │
       │                                                      │
       │  5. Extract thumbnail frame at 5-second mark         │
       │     Large: 1280×720 JPEG                             │
       │     Small: 640×360 JPEG                              │
       │     Animated preview: 3s WebP at 10fps               │
       │     Generate BlurHash from small thumbnail           │
       │                                                      │
       │  6. Upload thumbnail files to R2                     │
       │                                                      │
       │  7. Delete raw/{videoId}.mp4 from R2                 │
       │     (saves ~40% of video storage)                    │
       │                                                      │
       │  8. POST webhook to backend /internal/webhooks/      │
       │     transcode-complete                               │
       │     Payload: { videoId, hlsPrefix, duration,         │
       │                thumbnailKey, blurhash, qualities }    │
       └─────────────────────────────────────────────────────┘
```

### 7.2 ffmpeg HLS Generation Command

```bash
# Two-quality HLS output — optimized for mobile in variable network conditions
ffmpeg \
  -i "input.mp4" \
  -filter_complex \
    "[0:v]split=2[v720][v480]; \
     [v720]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720out]; \
     [v480]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v480out]" \
  \
  -map "[v720out]" -map 0:a -c:v:0 libx264 -crf 23 -preset fast \
    -b:v:0 2800k -maxrate:v:0 3000k -bufsize:v:0 6000k \
    -c:a:0 aac -b:a:0 128k \
  \
  -map "[v480out]" -map 0:a -c:v:1 libx264 -crf 23 -preset fast \
    -b:v:1 1400k -maxrate:v:1 1600k -bufsize:v:1 3000k \
    -c:a:1 aac -b:a:1 96k \
  \
  -var_stream_map "v:0,a:0 v:1,a:1" \
  -master_pl_name "master.m3u8" \
  -hls_time 4 \
  -hls_playlist_type vod \
  -hls_segment_filename "segments/%v_%04d.ts" \
  -hls_flags independent_segments \
  -f hls \
  "hls/%v.m3u8"

# Thumbnail extraction at 5-second mark
ffmpeg -i "input.mp4" -ss 5 -vframes 1 -vf "scale=1280:720:force_original_aspect_ratio=decrease" \
  -q:v 3 "thumb_lg.jpg"

ffmpeg -i "input.mp4" -ss 5 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease" \
  -q:v 4 "thumb_sm.jpg"

# Animated WebP preview (3 seconds at 30% into video — avoid static opening frames)
ffmpeg -i "input.mp4" -ss {duration*0.3} -t 3 \
  -vf "fps=10,scale=480:270:force_original_aspect_ratio=decrease" \
  -loop 0 "preview.webp"
```

### 7.3 HLS Quality Ladder

The 2-quality ladder (720p + 480p) is the recommended baseline for a mobile-first application in India.

| Profile | Resolution | Video Bitrate | Audio | Segment Duration | Use Case |
|---|---|---|---|---|---|
| 480p | 854×480 | 1,400 kbps | 96 kbps | 4s | 3G / weak 4G / data saver |
| 720p | 1280×720 | 2,800 kbps | 128 kbps | 4s | WiFi / strong 4G |
| 1080p (optional) | 1920×1080 | 4,500 kbps | 128 kbps | 4s | Add only for professional/HD content |
| 360p (optional) | 640×360 | 700 kbps | 96 kbps | 4s | Add only for very low-bandwidth markets |

**On 4-second segments:** This is the industry standard (YouTube, Netflix, HLS spec recommendation). Shorter segments (2s) improve seek precision but double the HTTP request count. Longer segments (8–10s) reduce requests but introduce 8–10s of seek inaccuracy and increase buffering on poor connections. 4 seconds balances all factors.

**Storage multiplier:** 2-quality HLS (720p + 480p) adds ~65–75MB per 5-minute video on top of the raw MP4. After raw deletion, total storage per 5-minute video ≈ 65–75MB vs 44MB raw — a 1.5× multiplier. This is the cost of adaptive bitrate capability.

### 7.4 Transcoding Infrastructure Scaling

| Scale | Videos/Day | Infrastructure | Monthly Cost |
|---|---|---|---|
| < 50/day | 1 VPS, 2 vCPU, 4GB RAM | DigitalOcean/Hetzner + BullMQ | ₹750–₹1,500 |
| 50–200/day | 1–2 VPS, 4 vCPU, 8GB RAM | Same + Redis | ₹1,500–₹4,000 |
| 200–1,000/day | 3–5 containerized workers | Docker + autoscaling | ₹4,000–₹12,000 |
| 1,000–5,000/day | Autoscaling container cluster | Kubernetes / AWS ECS | ₹12,000–₹40,000 |
| > 5,000/day | Managed transcoding (AWS MediaConvert) | Per-minute pricing | ~₹94/minute output |

**Autoscaling trigger:** Monitor the BullMQ queue depth. If pending jobs > 50 for more than 5 minutes, provision a new transcoding worker. If queue is empty for 10 minutes, de-provision idle workers. This scale-to-zero behavior minimizes cost while handling upload bursts.

**Worker concurrency:** Set BullMQ worker concurrency to 1–2 per VPS to prevent memory exhaustion. ffmpeg is CPU and memory-intensive — a single 1080p video transcode can consume 1–2GB RAM during processing.

### 7.5 Transcoding Job Failure Recovery

```javascript
// BullMQ worker with failure handling
const worker = new Worker('video:transcode', async (job) => {
  const { videoId, rawR2Key } = job.data;
  
  try {
    // Log job start
    await db.videos.update({ id: videoId }, {
      transcodeJobId: job.id,
      transcodeStartedAt: new Date(),
    });
    
    await runTranscodingPipeline(job.data);
    
  } catch (err) {
    console.error(JSON.stringify({
      event: 'transcode_error',
      videoId,
      attempt: job.attemptsMade,
      error: err.message,
      stack: err.stack,
    }));
    
    // On final failure (all retries exhausted)
    if (job.attemptsMade >= job.opts.attempts - 1) {
      await db.videos.update({ id: videoId }, {
        status: 'failed',
        transcodeError: err.message,
      });
      
      // Do NOT delete raw MP4 — retain for manual re-queuing
      
      // Alert engineering
      await slack.send({
        channel: '#alerts-media',
        text: `Video transcoding permanently failed: ${videoId}\nError: ${err.message}`,
      });
      
      // Notify user
      await sendPushNotification(userId, {
        title: 'Video processing failed',
        body: 'Your video could not be processed. Please try uploading again.',
        data: { videoId, type: 'transcode_failed' },
      });
    }
    
    throw err; // BullMQ will retry
  }
}, {
  connection: redisConnection,
  concurrency: 1,  // 1 concurrent transcode per worker process
});

// Dead-letter queue monitoring
const queueEvents = new QueueEvents('video:transcode', { connection: redisConnection });
queueEvents.on('failed', async ({ jobId, failedReason }) => {
  metrics.increment('transcode.failed', { jobId });
  if (await isFailureThresholdExceeded()) {
    await pagerduty.trigger({ description: 'Transcoding failure rate exceeded threshold' });
  }
});
```

---

## 8. Security Architecture

### 8.1 Defense-in-Depth Model

```
Layer 1: Cloudflare DDoS Protection (automatic, L3/L4)
  └── Anycast network absorbs volumetric attacks before reaching application

Layer 2: Cloudflare WAF + Rate Limiting (application L7)
  └── Rate limiting per IP per endpoint
  └── Bot Fight Mode: blocks automated upload tools
  └── Firewall rules: geo-restrictions if applicable

Layer 3: API Authentication (Node.js JWT)
  └── Short-lived access tokens (15-minute JWT)
  └── Long-lived refresh tokens (7-day, stored in Redis, revocable)
  └── All sensitive endpoints require valid JWT

Layer 4: Edge Media Authentication (Cloudflare Worker)
  └── HMAC-SHA256 signed media tokens
  └── Expiry validation on every request
  └── KV blacklist check on every request
  └── timingSafeEqual for all signature comparisons

Layer 5: Storage Access Control (R2)
  └── All buckets private — no public access
  └── Separate R2 API tokens per service with scoped permissions
  └── Backend API token: PutObject, DeleteObject, HeadObject, CreateMultipartUpload
  └── Transcoding VPS token: GetObject (raw bucket), PutObject (HLS bucket), DeleteObject (raw bucket only)

Layer 6: Upload Validation
  └── MIME type allowlist at presigned URL generation
  └── Content-Length enforcement in presigned URL
  └── Post-upload magic byte verification
  └── Content moderation scanning before status=ready
```

### 8.2 Token Architecture

| Token Type | Purpose | TTL | Issuer | Validator | Revocable |
|---|---|---|---|---|---|
| JWT Access Token | API authentication | 15 min | Node.js HS256 | Node.js middleware | Yes (refresh token revocation) |
| Refresh Token | Access token renewal | 7 days | Node.js | Node.js + Redis | Yes (stored in Redis) |
| HMAC Media Token | CDN media access | 1 hour | Node.js | Cloudflare Worker | Yes (KV blacklist) |
| Presigned PUT URL | Direct R2 upload | 15 min | Node.js (AWS SDK) | R2 (signature) | No (expiry only) |
| Presigned GET URL | One-time download | 5 min | Node.js (AWS SDK) | R2 (signature) | No (expiry only) |
| Webhook Secret | Internal service auth | Static | Manual rotation | Node.js constant-time | Via rotation |

### 8.3 Token Revocation with Workers KV

```javascript
// Worker: check blacklist on every authenticated request
const blacklisted = await env.TOKEN_BLACKLIST.get(
  `token:${payloadHash}`,
  { cacheTtl: 60 }  // KV result cached in Worker memory for 60s (reduces KV reads)
);
if (blacklisted) return new Response('Token revoked', { status: 401 });

// Node.js: revoke all active tokens on logout / password change
async function revokeUserMediaTokens(userId) {
  // Get all active token hashes for this user (stored in Redis at issuance time)
  const tokenHashes = await redis.smembers(`user:media_tokens:${userId}`);
  
  // Write each to KV blacklist with TTL = remaining token lifetime
  await Promise.all(tokenHashes.map(hash =>
    env.TOKEN_BLACKLIST.put(`token:${hash}`, '1', { expirationTtl: 3600 })
  ));
  
  // Clear the Redis set
  await redis.del(`user:media_tokens:${userId}`);
}
```

**KV blacklist considerations:** Workers KV has eventually-consistent reads with a typical propagation delay of < 60 seconds. A revoked token may remain valid for up to 60 seconds after revocation. This is acceptable for most security models. If immediate revocation is required (e.g., legal holds, severe abuse cases), use a Durable Object for strongly-consistent revocation checks — at higher latency and cost.

### 8.4 Upload Abuse Prevention

```javascript
// Rate limiting at presigned URL generation (Node.js + Redis)
const uploadRateLimiter = rateLimit({
  windowMs: 60_000,   // 1 minute window
  max: 10,            // 10 image uploads per minute per user
  keyGenerator: (req) => `upload:image:${req.user.id}`,
  message: { error: 'Upload rate limit exceeded' },
});

const videoRateLimiter = rateLimit({
  windowMs: 3_600_000,  // 1 hour window
  max: 5,               // 5 video uploads per hour per user
  keyGenerator: (req) => `upload:video:${req.user.id}`,
});

// Cloudflare Rate Limiting rules (applied at edge before backend)
// POST /api/media/image/upload-url: 10 requests/minute/IP → block 1 hour
// POST /api/media/video/initiate: 3 requests/minute/IP → block 1 hour
// POST /auth/login: 5 requests/minute/IP → block 10 minutes
```

### 8.5 Content Moderation

```javascript
// Post-upload content moderation (async — does not block confirm response)
async function moderateUploadedContent(mediaId, r2Key, contentType) {
  // Download image for moderation (use presigned GET URL)
  const imageBuffer = await downloadFromR2(r2Key);
  
  // Google Vision SafeSearch API (or AWS Rekognition)
  const modResult = await visionClient.safeSearchDetection(imageBuffer);
  const { adult, violence, racy } = modResult.safeSearchAnnotation;
  
  if (['LIKELY', 'VERY_LIKELY'].includes(adult) || ['LIKELY', 'VERY_LIKELY'].includes(violence)) {
    // Immediate soft-delete from DB + schedule R2 deletion
    await db.media.update({ id: mediaId }, { status: 'moderated' });
    await scheduleR2Deletion(r2Key, r2Bucket);
    await notifyTrustAndSafety(mediaId, { adult, violence, racy });
    return { action: 'removed', reason: 'policy_violation' };
  }
  
  return { action: 'approved' };
}
```

**Hash-based duplicate detection:**

```javascript
// On upload completion, compute SHA-256 of uploaded file
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

// Check against known hash database (banned content)
const banned = await db.bannedHashes.findOne({ sha256 });
if (banned) {
  await deleteFromR2(r2Key, r2Bucket);
  throw new Error('Content hash matches banned content');
}

// Perceptual hash (pHash) for near-duplicate detection of re-uploaded banned content
// Requires additional library (e.g., sharp + custom pHash implementation)
```

### 8.6 Mobile Auth Considerations

**Anti-pattern: IP binding for mobile tokens.** Binding media tokens to a specific IP address (recommended in some documentation) is problematic for mobile users:
- Mobile IPs change constantly: carrier NAT, WiFi ↔ 4G switches, network handoffs
- Indian mobile networks frequently reassign IPs mid-session
- IP binding causes false positives (legitimate users denied) more than it prevents abuse

**Correct alternative:** Bind to `userId + deviceId` instead. Include `deviceId` (a stable, app-generated UUID stored in flutter_secure_storage) in the token payload. The Worker validates that the token was issued for this device. This catches token theft across devices without false positives from IP changes.

---

## 9. Scalability Architecture

### 9.1 Component Scaling Analysis

| Component | Scales | Scaling Mechanism | Action at Scale |
|---|---|---|---|
| R2 Storage | ✅ Infinite | Automatic (Cloudflare managed) | None — no configuration |
| Cloudflare CDN | ✅ Infinite | Automatic (Cloudflare network) | None — no throttle |
| Cloudflare Workers | ✅ Auto-scales to 0 | Cloudflare auto-provisioning | Monitor CPU time p99 (50ms limit) |
| Node.js API | ❌ Manual | PM2 cluster / Docker horizontal | Add instances at 50K users |
| MongoDB | ❌ Manual | Replica sets / horizontal sharding | Add secondary node at 100K users |
| Redis Queue | ⚠️ Semi-manual | Redis Cluster | Cluster at >100K jobs/day |
| Transcoding Workers | ❌ Manual | BullMQ + autoscaling containers | Scale on queue depth threshold |

### 9.2 Scaling Stages

**Stage 1: 0–10K users**
- Single Node.js instance (PM2 cluster mode for CPU utilization)
- Single transcoding VPS (2 vCPU, 4GB RAM)
- R2 free tier covers storage; Workers free plan covers early traffic
- Total infra cost: ₹750–₹2,500/month

**Stage 2: 10K–50K users**
- 2× Node.js behind a load balancer (Nginx or Cloudflare Load Balancing)
- 2 transcoding workers; BullMQ concurrency tuned
- Workers Paid plan essential (₹470.75/month)
- Redis managed service recommended (UpStash free tier covers up to ~10K jobs/day)
- Total infra cost: ₹2,500–₹8,000/month

**Stage 3: 50K–200K users**
- Containerized Node.js (Docker + K8s or ECS); horizontal autoscaling
- 3–5 transcoding containers with autoscaling on BullMQ queue depth
- MongoDB secondary node for metadata read offloading
- Enable Cloudflare Cache Reserve for popular video segments
- Total infra cost: ₹8,000–₹30,000/month

**Stage 4: 200K–1M users**
- Multi-region Node.js (India + Singapore for APAC coverage)
- Autoscaling transcoding cluster (Kubernetes with KEDA based on queue metrics)
- MongoDB replica set with reads from secondaries; enable sharding at high write volumes
- Switch Cloudflare Images to custom Worker transforms (> 500K transforms/month)
- Total infra cost: ₹30,000–₹1,50,000/month

**Stage 5: 1M+ users**
- Negotiate Cloudflare Enterprise agreement (volume pricing, SLA upgrades)
- Multi-account R2 architecture for bucket-level sharding
- Tiered storage automation: hot objects in Standard, cold in IA, very cold in archival
- Hybrid transcoding: R2+HLS for most content; Cloudflare Stream for top-creator live events only
- Total infra cost: ₹1,50,000–₹3,00,000+/month (highly workload-dependent)

### 9.3 Hot Object Mitigation

When a video goes viral, R2 may receive a brief spike of cache-miss requests before the CDN cache warms at each PoP. Mitigation strategies:

1. **Tiered cache (Cache Reserve):** Enables a second-level regional cache backed by R2. Popular content is read from Cache Reserve rather than R2 on regional cache misses, reducing R2 operation counts. Cost: $0.015/GB/month.

2. **Request coalescing:** Cloudflare CDN natively coalesces concurrent cache-miss requests for the same object. If 100 users simultaneously request the same uncached segment, Cloudflare sends a single request to R2 and fans out the response to all 100 requesters. This prevents R2 from seeing 100× the actual cache-miss rate.

3. **Pre-warming via CDN crawl:** For predictably viral content (scheduled announcement videos, new episode drops), pre-request all HLS segments from each major regional PoP before the content goes live. This is an advanced operational pattern used by YouTube and Netflix.

### 9.4 Worker CPU Limits

Cloudflare Workers have a 50ms CPU time limit per invocation on the Paid plan (10ms on Free). For HMAC validation and cache key manipulation, typical CPU time is 2–5ms. Ensure this budget is not exceeded:

- HMAC verification: ~1ms
- KV blacklist check: ~2ms (async, doesn't block CPU)
- R2 fetch initiation: async
- Response construction: ~1ms

**Total CPU budget used: ~4ms** — well within the 50ms limit. If custom image transformation is added to the Worker, benchmark the CPU time carefully. `sharp` compiled to WASM can consume 15–30ms for a 400×400 crop.

### 9.5 Multi-Region Considerations

R2 is a globally distributed object store without explicit region selection. Cloudflare automatically routes R2 operations to the nearest data center. For the majority of workloads, this is sufficient and delivers consistent low-latency access globally.

For workloads with strict data residency requirements (GDPR, India's PDPB), evaluate R2's data residency options as Cloudflare adds jurisdiction controls. As of May 2026, R2 stores data globally by default. Evaluate Cloudflare's regional storage products for compliance-sensitive deployments.

---

## 10. Cost Optimization

### 10.1 Pricing Reference

| Service | Rate (USD) | Rate (INR) | Free Tier |
|---|---|---|---|
| R2 Standard Storage | $0.015/GB/month | ₹1.41/GB/month | 10 GB/month |
| R2 Infrequent Access | $0.010/GB/month | ₹0.94/GB/month | — |
| R2 IA Retrieval | $0.010/GB | ₹0.94/GB | — |
| R2 Class A Ops (PUT/POST/LIST) | $4.50/million | ₹423.68/million | 1M/month |
| R2 Class B Ops (GET/HEAD) | $0.36/million | ₹33.89/million | 10M/month |
| R2 Egress | **$0.00** | **₹0.00** | Always free |
| CF Images Transformations | $0.50/1,000 ops | ₹47.08/1,000 ops | 5,000/month |
| CF Workers Paid Plan | $5.00/month | ₹470.75/month | 100K req/day (free plan) |
| CF Workers Additional Requests | $0.50/million | ₹47.08/million | 10M/month included in paid |
| CF Stream Storage | $5.00/1,000 min | ₹470.75/1,000 min | — |
| CF Stream Delivery | $1.00/1,000 min | ₹94.15/1,000 min | — |
| Workers KV Reads | $0.50/million | ₹47.08/million | 100K reads/day |
| Cache Reserve | $0.015/GB/month | ₹1.41/GB/month | — |

### 10.2 Cost Scenarios

**Scenario A: Video-Heavy Application (R2 + HLS)**

Assumptions: 4.5 videos/creator × 5min avg × 80MB HLS stored/video; 20 views/video/month; CDN caches 95%+ of segment reads.

| Scale | Video Storage | R2 Ops | Workers Paid | Transcoding VPS | **Total/Month** |
|---|---|---|---|---|---|
| 1K creators | ₹508 | ₹94 | ₹470.75 | ₹750–₹2,000 | **~₹1,823–₹3,073** |
| 10K creators | ₹5,078 | ₹941 | ₹470.75 | ₹2,000–₹4,000 | **~₹8,490–₹10,490** |
| 100K creators | ₹50,778 | ₹9,415 | ₹941.50 | ₹4,000–₹8,000 | **~₹65,135–₹69,135** |
| 500K creators | ₹2,53,890 | ₹47,075 | ₹2,827 | ₹10,000–₹18,000 | **~₹3,13,792–₹3,21,792** |

**Scenario A (comparison): Cloudflare Stream — same workload**

| Scale | Stream Storage | Stream Delivery (20 views) | **Total/Month** | Ratio vs R2+HLS |
|---|---|---|---|---|
| 1K creators | ₹10,592 | ₹42,368 | **₹52,960** | 17–29× more expensive |
| 10K creators | ₹1,05,919 | ₹4,23,675 | **₹5,29,594** | 50–63× more expensive |
| 100K creators | ₹10,59,190 | ₹42,36,750 | **₹52,95,940** | 77× more expensive |

**Scenario B: Photo-Heavy Application**

Assumptions: 5 photos/user × 200KB avg; 50 image requests/user/month; 3 transform sizes per image via CF Images.

| Scale | R2 Storage | CF Images | Workers Paid | **Total/Month** |
|---|---|---|---|---|
| 1K users | ₹1.41 | ₹141 | ₹470.75 | **~₹613** |
| 10K users | ₹14 (within free) | ₹1,412 | ₹470.75 | **~₹1,897** |
| 100K users | ₹127 | ₹14,123 | ₹517.83 | **~₹14,768** |
| 1M users | ₹1,270 | ₹1,41,225 | ₹1,883 | **~₹1,44,378** |

> At 1M users, CF Images transform fees dominate. Switch to custom Worker-based transforms (sharp WASM) to reduce to ~₹8,000/month. Breakeven point is ~500K transformations/month.

**Scenario C: Viral traffic event**

Single video post goes viral — 1M segment requests in 24 hours:

| Cost Component | Volume | Cost |
|---|---|---|
| R2 egress | 1M × ~400KB segments | **₹0** (always free) |
| CDN delivery (99%+ from cache) | Served from edge | **₹0** (CDN bandwidth free) |
| R2 Class B ops (1% cache miss) | ~10K ops | **₹0.34** (within free tier) |
| Worker token validations | 1M HLS playlist requests | **~₹47.08** |
| **Total viral event cost** | | **~₹47** |

AWS S3 + CloudFront equivalent: 400GB egress × $0.09 = $36 = **₹3,389** — a 72× difference.

**Scenario D: High concurrency streaming**

10,000 concurrent viewers × 30 min/day × 30 days:

| Metric | Volume | Cost |
|---|---|---|
| Minutes delivered | 9,000,000 | — |
| R2 egress | CDN-served | **₹0** |
| R2 Class B ops (5% miss) | ~450,000 unique segments | **₹15.25** |
| Worker validations | ~9M playlist requests | **~₹423.68** |
| **Total monthly streaming cost** | | **~₹439** |

Cloudflare Stream equivalent: 9M min × $0.001/min delivery = $9,000 = **₹8,47,350** — a **1,930× difference**.

### 10.3 Cost Optimization Levers

**Lever 1: CDN cache-hit rate (highest impact)**

Every 1% improvement in cache hit rate reduces R2 Class B operations by 1%. At 1M users with 90M segment reads/month, moving from 85% to 95% cache hit rate saves 9M Class B operations = ₹305/month. Strategies:
- Set `immutable` Cache-Control on all HLS segments
- Consistent cache key design (token-stripped)
- Enable Cache Reserve for large video catalogs with long-tail access

**Lever 2: Raw MP4 deletion (40% video storage reduction)**

Deleting raw MP4 files after successful HLS generation reduces video storage by ~40%. A 44MB raw file becomes 65–75MB HLS — but the raw file is no longer needed after transcoding. Delete it immediately after confirmed successful upload and HLS generation.

**Lever 3: R2 Infrequent Access for archives**

Move video HLS content older than 90 days to R2 IA storage (₹0.94/GB vs ₹1.41/GB Standard — 33% savings). Note IA retrieval costs ($0.01/GB) — ensure your CDN cache hit rate absorbs most reads before moving content to IA. Content with < 5% cache hit rate should stay in Standard.

**Lever 4: Client-side pre-compression**

Compress images to 85% JPEG quality and max 2048px on the Flutter client before upload. This reduces:
- R2 storage cost (smaller originals)
- CF Images transformation computation (smaller source)
- Upload time and mobile data usage

Compress videos to max 1080p / 5Mbps before upload. A 4K/30Mbps video compressed to 1080p/5Mbps reduces upload size by 6× before any transcoding occurs.

**Lever 5: Custom Worker transforms at scale**

At > 1M CF Images transformations/month: implement `sharp` (compiled to WASM) in a Cloudflare Worker to eliminate transformation fees entirely. Engineering cost: ~1 week. Monthly savings at 1M transforms: ₹47,075. Break-even: immediate on the first month.

**Lever 6: Workers Free Plan ceiling**

The Workers Free Plan cap is 100K requests/day (~3M/month). A production app with real traffic will hit this. Upgrade to Workers Paid ($5/month = ₹470.75/month) before launch, not after the first outage.

---

## 11. Failure Scenarios & Recovery

### 11.1 Failure Matrix

| Failure | Detection | User Impact | Recovery Strategy | Time to Recover |
|---|---|---|---|---|
| R2 upload URL expired (403) | Client HTTP 403 | Upload fails | Re-request presigned URL for same key; retry PUT | < 5 seconds |
| Network interruption during multipart upload | Client timeout / partial ETags | Upload interrupted | Resume from completed parts (stored in flutter_secure_storage) | Immediate on reconnect |
| R2 degradation | Cloudflare status page; elevated 5xx | Media unavailable | 503 + Retry-After; auto-recover when R2 restores | Cloudflare SLA: 99.9% |
| Transcoding job failure | BullMQ job.failed event | Video stuck in processing | Auto-retry 3× with exponential backoff; permanent failure → user notification + engineering alert | 1–7 min (3 retries) |
| Transcoding VPS OOM | Worker crash | Job lost | BullMQ crash-recovery re-queues job on next worker startup | On worker restart |
| Worker secret key misconfiguration | Elevated 401 errors | No media playback | Deploy corrected Worker secret via wrangler; Cloudflare deploys in ~30s globally | < 2 minutes |
| KV blacklist write failure | KV write error log | Token not revoked (security gap) | Alert engineering; fallback: short JWT TTL (15min) limits exposure window | Engineering response |
| Presigned URL generation exceeds rate limit | HTTP 429 from backend | Upload blocked | Client backs off; rate limit applies per user, not globally | 1 minute |
| CDN cache poisoning | Anomalous content in responses | Incorrect content served | URL key rotation (new UUID) + explicit cache purge via Cloudflare API | < 5 minutes |
| Database outage | API 5xx; upload/confirm fails | Full service degradation | Read from MongoDB secondary; cache last-known media URLs in Redis | Per MongoDB SLA |
| Webhook delivery failure | Transcoding worker log | Video status not updated | Webhook retry logic (3× with backoff); poll-based fallback: transcoding worker checks DB directly | 1–5 minutes |
| HLS master playlist corrupt | Player parse error | Video unplayable | Re-trigger transcoding for the video; raw MP4 retained for re-processing | Manual or auto-retry |

### 11.2 Expired Upload URL Recovery

```dart
// Flutter: handle presigned URL expiry gracefully
Future<void> uploadPart(PartUploadState part, Uint8List data) async {
  for (int attempt = 0; attempt < 5; attempt++) {
    try {
      final response = await dio.put(
        part.uploadUrl,
        data: Stream.fromIterable([data]),
        options: Options(
          headers: {'Content-Type': 'video/mp4'},
          sendTimeout: Duration(seconds: 120),
        ),
      );
      
      final etag = response.headers.value('etag') ?? response.headers.value('ETag');
      part.etag = etag;
      await persistPartState(part); // Save to flutter_secure_storage
      return; // Success
      
    } on DioException catch (e) {
      if (e.response?.statusCode == 403) {
        // Presigned URL expired — request a new one
        final newUrl = await apiClient.getPartUploadUrl(videoId, part.partNumber);
        part.uploadUrl = newUrl.uploadUrl;
        continue; // Retry with new URL
      }
      
      if (attempt < 4) {
        await Future.delayed(Duration(seconds: pow(2, attempt).toInt()));
        continue;
      }
      rethrow;
    }
  }
}
```

### 11.3 Transcoding Re-queue Recovery

```javascript
// Admin or automatic endpoint to re-queue permanently failed transcodes
app.post('/api/admin/video/:id/retry-transcode', adminAuth, async (req, res) => {
  const video = await db.videos.findOne({ id: req.params.id, status: 'failed' });
  if (!video) return res.status(404).json({ error: 'Video not found or not in failed state' });
  
  // Verify raw MP4 still exists in R2 (should not have been deleted on failure)
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_VIDEOS_BUCKET, Key: video.rawR2Key }));
  } catch {
    return res.status(422).json({ error: 'Raw video no longer in storage — cannot re-transcode' });
  }
  
  // Reset status and re-queue
  await db.videos.update({ id: video.id }, {
    status: 'processing',
    transcodeError: null,
    transcodeStartedAt: null,
  });
  
  await transcodeQueue.add('transcode', {
    videoId: video.id,
    rawR2Key: video.rawR2Key,
    outputPrefix: `hls/${video.id}/`,
    qualities: ['720p', '480p'],
  }, { jobId: `retry-${video.id}-${Date.now()}` }); // New jobId to bypass deduplication
  
  res.json({ status: 'requeued' });
});
```

### 11.4 Queue Overflow Mitigation

If the transcoding queue depth exceeds 100 jobs (indicating upload burst beyond processing capacity):

1. **Immediate:** Alert engineering. Provision additional transcoding workers.
2. **User experience:** Display a "Your video is in queue — usually ready within X minutes" message based on queue depth estimation.
3. **Priority queue:** Premium users' videos go to a `video:transcode:priority` queue with dedicated worker concurrency.
4. **Dead-letter inspection:** Jobs in the dead-letter queue (failed after all retries) require manual inspection. Common causes: corrupt input, ffmpeg crash on unusual codec, R2 intermittent write failure.

---

## 12. Production Best Practices

### 12.1 Operations Checklist

**Storage & Upload:**
- [ ] All R2 buckets private — `r2.dev` subdomain disabled in production
- [ ] Separate R2 API tokens per service (backend, transcoding VPS, Worker) — principle of least privilege
- [ ] Multipart upload abort lifecycle rule set to 7 days on all video buckets
- [ ] Content-Length enforced in all presigned PUT URLs
- [ ] Post-upload magic byte verification for all image types
- [ ] Client-side compression before upload (images: 85% JPEG ≤ 2048px; video: max 1080p/5Mbps)
- [ ] R2 object keys stored in DB — never full CDN URLs
- [ ] UUID-based object keys generated by backend — never trust client-provided keys

**Video Pipeline:**
- [ ] 4-second HLS segments
- [ ] `-movflags faststart` on any MP4 served directly (short clips)
- [ ] Thumbnails and BlurHash generated during transcoding, stored in DB
- [ ] Raw MP4 deleted from R2 after confirmed HLS generation
- [ ] BullMQ retry: 3 attempts, exponential backoff (1min, 2min, 4min)
- [ ] Transcoding worker crash recovery via BullMQ stalled job detection
- [ ] Dead-letter queue monitoring with alert at > 5 failed jobs/hour

**Security:**
- [ ] HMAC-SHA256 (never HMAC-MD5 or plain tokens)
- [ ] `timingSafeEqual` for all token comparisons in Worker
- [ ] Token blacklist in Workers KV on logout and password change
- [ ] Dual-secret rotation support in Worker (current + previous)
- [ ] CORS restricted to app domain only — never wildcard `*`
- [ ] `wrangler secret put` for all Worker secrets — never in wrangler.toml or code
- [ ] R2 API keys rotated every 90 days
- [ ] Content moderation before status=ready for user-uploaded images

**CDN Performance:**
- [ ] Token stripped from CDN cache key in Worker
- [ ] `public, max-age=86400, immutable` on HLS segments
- [ ] `public, max-age=300` on HLS playlists
- [ ] `public, max-age=2592000, immutable` on thumbnails
- [ ] `Accept-Ranges: bytes` header on all video responses
- [ ] Range header passed through Worker to R2 for seek support

**Monitoring:**
- [ ] Alert: Worker error rate > 0.5% over 5 minutes
- [ ] Alert: Transcoding queue depth > 50 jobs
- [ ] Alert: Upload failure rate > 5%
- [ ] Alert: Token validation failure rate > 1% (possible abuse/brute force)
- [ ] Alert: Worker CPU p99 > 40ms (approaching 50ms limit)
- [ ] Alert: R2 Class B operations > 8M/month (80% of free tier)
- [ ] Alert: Any transcoding cost spike > 20% month-over-month

**Cost:**
- [ ] Workers Paid plan active for production (free plan 100K req/day causes outages)
- [ ] R2 lifecycle policies: Standard → IA transition after 90 days for cold content
- [ ] Hard-delete from R2 on content deletion (30-day grace, then delete)
- [ ] Billing alerts configured in Cloudflare dashboard

### 12.2 Deployment Guidance

**Cloudflare Worker deployment:**

```bash
# wrangler.toml — production configuration
name = "media-worker"
main = "src/worker.js"
compatibility_date = "2025-01-01"

[[r2_buckets]]
binding = "MEDIA_IMAGES"
bucket_name = "media-images-prod"

[[r2_buckets]]
binding = "MEDIA_VIDEOS"
bucket_name = "media-videos-prod"

[[kv_namespaces]]
binding = "TOKEN_BLACKLIST"
id = "{your-kv-namespace-id}"

[analytics_engine_datasets]
binding = "ANALYTICS"
dataset = "media_access_events"

# Secrets (set via CLI, never in wrangler.toml):
# wrangler secret put MEDIA_TOKEN_SECRET
# wrangler secret put MEDIA_TOKEN_SECRET_PREV

# Routes
[[routes]]
pattern = "media.yourdomain.com/*"
zone_name = "yourdomain.com"
```

**Node.js environment separation:**

```
.env.production:
CF_ACCOUNT_ID=
R2_ACCESS_KEY_ID=         # Backend token (PutObject, DeleteObject, HeadObject, CreateMultipartUpload)
R2_SECRET_ACCESS_KEY=
R2_IMAGES_BUCKET=media-images-prod
R2_VIDEOS_BUCKET=media-videos-prod
MEDIA_TOKEN_SECRET=       # 256-bit random; must match Worker secret
CDN_BASE_URL=https://media.yourdomain.com
REDIS_URL=                # BullMQ queue
JWT_SECRET=               # API authentication
WEBHOOK_SECRET=           # Transcoding VPS → backend webhook auth
```

### 12.3 Observability

**Cloudflare Workers Analytics Engine** (free, 100K data points/day):
```javascript
// In Worker: write analytics event per media request
ctx.waitUntil(env.ANALYTICS.writeDataPoint({
  blobs: [
    url.pathname,          // Resource path
    payload.rtype,         // 'video' | 'image'
    request.cf?.country || 'unknown', // Country
    isHit ? 'hit' : 'miss',           // CDN cache status
  ],
  doubles: [r2Object?.size || 0],     // Response size in bytes
  indexes: [payload.sub],             // userId (for per-user analytics)
}));
```

**Node.js structured logging (pino):**
```javascript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Log all presigned URL issuances (audit trail)
logger.info({
  event: 'presigned_url_issued',
  userId: req.user.id,
  mediaId,
  mediaType: contentType,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: Date.now(),
});
```

**Key metric targets:**

| Metric | Target | Alert Threshold |
|---|---|---|
| CDN cache hit rate (video segments) | > 95% | < 85% |
| Worker error rate | < 0.1% | > 0.5% |
| Upload success rate | > 98% | < 95% |
| Transcoding success rate | > 99% | < 97% |
| Transcoding queue depth | < 20 pending | > 50 pending |
| Worker CPU time p99 | < 20ms | > 40ms |
| Video playback start failure rate | < 0.5% | > 2% |
| HMAC token validation failure rate | < 0.5% | > 1% (possible attack) |

---

## 13. Provider Comparison

### 13.1 Object Storage Comparison

| Dimension | Cloudflare R2 | AWS S3 | Backblaze B2 | Firebase Storage | Supabase Storage |
|---|---|---|---|---|---|
| Storage/GB/month | ₹1.41 | ₹2.17 | ₹0.57 | ₹2.26 | ₹1.89 |
| Egress/GB | **₹0** | ₹8.49 (after 100GB) | Free (via Cloudflare) | ₹8.49 | ₹8.49 |
| CDN integration | Native (330+ PoPs) | Via CloudFront (extra) | Via Cloudflare (partner) | Google CDN | Limited |
| S3 API compatible | ✅ Full | ✅ Native | ✅ Full | ❌ Proprietary | ⚠️ Partial |
| Edge compute | ✅ Workers (native, $5/mo) | ✅ Lambda@Edge (complex, expensive) | ❌ | ❌ | ❌ |
| Image transform | ✅ CF Images | Via Lambda@Edge | ❌ | Via Extensions | Via imgproxy |
| Vendor lock-in | **Low** (S3 API, ₹0 exit) | High | Low | Very High | Medium |
| India PoPs | ✅ Multiple | ✅ Mumbai | ✅ Via Cloudflare | ✅ Mumbai | ⚠️ |
| Exit cost | **₹0** | ₹8.47+/GB | ₹0.94/GB excess | ₹11.30/GB | ₹8.47/GB |

### 13.2 Video Platform Comparison

| Service | Cost at 1K creators, 20 views/video/month | Lock-in | Live streaming | Engineering effort |
|---|---|---|---|---|
| **R2 + HLS (Recommended)** | **₹1,823–₹3,073** | None | No | High (1–2 weeks) |
| Cloudflare Stream | ₹52,960 | Moderate | ✅ Yes | Low (1–2 days) |
| Mux | ~₹12,000–₹18,000 | High | ✅ Yes | Low (1–2 days) |
| Bunny Stream | ~₹4,500–₹6,000 | Moderate | ✅ Yes | Medium (3–5 days) |
| AWS MediaConvert + S3 | ~₹18,000–₹25,000 | Very High | ✅ Via IVS | High (2–4 weeks) |

**Bunny Stream** is the closest cost competitor to R2+HLS. At small scale, Bunny Stream is viable if engineering capacity is constrained. At 10K+ creators, R2+HLS's economics decisively win.

### 13.3 Vendor Lock-In Assessment

| Component | Lock-In Level | Exit Path |
|---|---|---|
| R2 Storage | **Low** | Full S3-compatible API; zero egress; rclone to any S3 provider |
| HLS video format | **None** | Open standard; any CDN or player supports it |
| Cloudflare Workers | **Medium** | Standard Web APIs (Fetch, SubtleCrypto, Cache); rewrite as Node.js Express middleware in 1–2 weeks |
| Cloudflare Images | **Medium** | Transform URL format is proprietary; switch to imgix, Fastly IO, or custom Worker (1 week) |
| HMAC media tokens | **None** | Standard HMAC-SHA256; any platform can verify the same tokens |
| Cloudflare Stream | **High** | Proprietary upload API and video IDs; no export API; full re-upload required to migrate |

The recommended architecture (R2 + HLS + Worker) has an overall portability score that is unique in the managed media space. Every component either uses an open standard or has a straightforward migration path. The single highest-lock-in risk — Cloudflare Stream — is explicitly avoided in this architecture.

---

## 14. Pricing Reference

### 14.1 R2 Object Storage

| Dimension | Rate (USD) | Rate (INR) | Free Tier |
|---|---|---|---|
| Standard Storage | $0.015/GB/month | ₹1.41/GB/month | 10 GB/month |
| Infrequent Access Storage | $0.010/GB/month | ₹0.94/GB/month | — |
| IA Data Retrieval | $0.010/GB | ₹0.94/GB | — |
| Class A Ops — Standard (PUT, POST, LIST) | $4.50/million | ₹423.68/million | 1M/month |
| Class A Ops — IA | $9.00/million | ₹847.35/million | — |
| Class B Ops — Standard (GET, HEAD) | $0.36/million | ₹33.89/million | 10M/month |
| Class B Ops — IA | $0.90/million | ₹84.74/million | — |
| Egress (all classes, all destinations) | **$0.00** | **₹0.00** | Always free |
| Delete, AbortMultipart | Free | ₹0 | Always free |
| Unauthorized (401) requests | Not billed | ₹0 | Always |

**IA tier requirement:** 30-day minimum storage duration. Objects deleted before 30 days are billed for the full 30 days. Use IA only for objects confirmed to be retained for 30+ days.

### 14.2 Cloudflare Stream

| Dimension | Rate (USD) | Rate (INR) |
|---|---|---|
| Video Storage | $5.00/1,000 min stored | ₹470.75/1,000 min |
| Video Delivery | $1.00/1,000 min delivered | ₹94.15/1,000 min |
| Encoding/Ingress | Free | ₹0 |
| Egress/Bandwidth | Included in delivery | ₹0 additional |
| Minimum storage purchase | $5.00/month | ₹470.75/month |

**Billing nuance:** Storage is prepaid in $5 increments. Client-side buffering and preloading count as billable delivery minutes. You cannot store 10 minutes for $0.05 — the minimum is $5.00/month.

### 14.3 Cloudflare Images

| Dimension | Rate (USD) | Rate (INR) | Free Tier |
|---|---|---|---|
| Transformations | $0.50/1,000 ops | ₹47.08/1,000 ops | 5,000/month |
| Storage (hosted in Images) | $5.00/100,000 images | ₹470.75/100K | — |
| Delivery (hosted in Images) | $1.00/100,000 images | ₹94.15/100K | — |

**Transform-only mode (recommended):** Store originals in R2; only transformation fees apply. Storage and delivery fees are waived when using R2 as the origin.

### 14.4 Cloudflare Workers

| Dimension | Rate (USD) | Rate (INR) |
|---|---|---|
| Free Plan | 100K requests/day | Free |
| Workers Paid Plan | $5.00/month | ₹470.75/month |
| Paid Plan: included requests | 10M/month | Included |
| Additional requests (beyond 10M) | $0.50/million | ₹47.08/million |

Workers Paid also includes: Workers KV (basic tier), Queues (1M messages/month), Durable Objects (basic tier).

### 14.5 Supporting Services

| Service | Rate (USD) | Rate (INR) | Free Tier |
|---|---|---|---|
| Workers KV Reads | $0.50/million | ₹47.08/million | 100K reads/day |
| Workers KV Writes | $1.00/million | ₹94.15/million | 1K writes/day |
| Cloudflare Queues | $0.40/million messages | ₹37.66/million | 1M messages/month |
| Cache Reserve | $0.015/GB/month | ₹1.41/GB/month | — |
| CDN Bandwidth | **Free** | **₹0** | Always free |

---

## Appendix: Monthly Cost Summary by Growth Stage

| Stage | Users | Architecture Notes | Estimated Monthly Cost |
|---|---|---|---|
| MVP | 500 | R2 free tier + Workers Paid + single VPS | **₹1,221–₹2,471** |
| Early Growth | 5,000 | R2 + Workers Paid + CF Images + VPS | **₹2,350–₹4,000** |
| Growth | 25,000 | R2 + Workers Paid + CF Images + 2× VPS | **₹7,000–₹11,000** |
| Scale | 100,000 | R2 (IA for cold) + Workers + CF Images + 3× VPS | **₹18,000–₹30,000** |
| Large Scale | 500,000 | R2 + Workers + custom Worker transforms + autoscaling VPS cluster | **₹75,000–₹1,20,000** |
| Enterprise | 1,000,000 | R2 + Workers + custom transforms + Kubernetes transcoding | **₹1,50,000–₹2,50,000** |

*All INR values at 1 USD = ₹94.15 (May 7, 2026 verified rate). Estimates assume mixed photo + video application with moderate engagement. High-streaming scenarios increase Worker costs. Aggressive CDN caching is the primary cost mitigation at all scales.*

---

*Architecture document compiled May 2026. Cloudflare pricing verified from official documentation at developers.cloudflare.com. Exchange rate verified via Trading Economics, Wise, BookMyForex. All architecture patterns reflect production systems as of May 2026.*

*Primary sources: Cloudflare R2 Docs, Cloudflare Workers Docs, Cloudflare Images Docs, Cloudflare Stream Docs, Cloudflare Workers Pricing, Cloudflare ToS Update (October 2025 — video delivery from R2 explicitly permitted).*
