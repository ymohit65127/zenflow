# 11 — Chat v2 Implementation

**Stack:** Next.js 15 App Router · TypeScript 5 · tRPC v11 · Prisma v6 · PostgreSQL 16 · Socket.io · Redis Pub/Sub · BullMQ · MinIO

---

## 1. Overview

Chat v2 upgrades ZenFlow's messaging module to a Slack-equivalent experience: threaded conversations, emoji reactions, voice/video calls, scheduled messages, file attachments with thumbnail generation, incoming webhooks for third-party tools, per-user notification preferences, message bookmarks, user presence status, full-text search, and a message retention policy enforced by a BullMQ cron job. Real-time delivery uses Socket.io backed by Redis Pub/Sub, allowing horizontal scaling across multiple Next.js instances.

---

## 2. Database Schema

### 2.1 ChatChannel (upgrade)

```prisma
model ChatChannel {
  id                  String    @id @default(cuid())
  org_id              String
  name                String    @db.VarChar(200)
  description         String?   @db.Text
  topic               String?   @db.VarChar(500)
  icon                String?   @db.VarChar(100)
  type                ChannelType @default(public)
  is_archived         Boolean   @default(false)
  archived_at         DateTime?
  archived_by         String?   @db.VarChar(36)
  message_count       Int       @default(0)     // Cached, incremented on insert
  member_count        Int       @default(0)     // Cached, updated on join/leave
  pinned_message_ids  String[]
  last_message_id     String?   @db.VarChar(36)
  last_message_at     DateTime?
  retention_days      Int?      // null = keep forever; set e.g. 90 to purge after 90 days
  purpose             String?   @db.VarChar(500)
  created_by          String    @db.VarChar(36)
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  org          Organization     @relation(fields: [org_id], references: [id], onDelete: Cascade)
  memberships  ChatMembership[]
  messages     ChatMessage[]
  webhooks     ChatIncomingWebhook[]
  calls        ChatCall[]

  @@index([org_id, type, is_archived])
  @@map("chat_channels")
}

enum ChannelType { public private dm group_dm }
```

### 2.2 ChatMessage (upgrade)

```prisma
model ChatMessage {
  id                     String      @id @default(cuid())
  channel_id             String
  user_id                String
  content                String      @db.Text
  content_tsvector       Unsupported("tsvector")?   // FTS
  thread_parent_id       String?     // null = root message; non-null = thread reply
  thread_reply_count     Int         @default(0)    // Cached on root messages
  thread_last_reply_at   DateTime?
  thread_participant_ids String[]
  edited_at              DateTime?
  deleted_at             DateTime?
  is_pinned              Boolean     @default(false)
  pinned_by              String?     @db.VarChar(36)
  pinned_at              DateTime?
  message_type           MessageType @default(text)
  metadata               Json?       @db.JsonB  // SystemMessage, WorkflowNotification payloads
  forwarded_from_id      String?     // self-reference FK
  delivery_status        DeliveryStatus @default(sent)
  reactions_summary      Json?       @db.JsonB  // {"👍":3,"❤️":1} for quick render
  created_at             DateTime    @default(now())

  channel       ChatChannel         @relation(fields: [channel_id], references: [id], onDelete: Cascade)
  author        User                @relation(fields: [user_id], references: [id])
  thread_parent ChatMessage?        @relation("ThreadReplies", fields: [thread_parent_id], references: [id])
  thread_replies ChatMessage[]      @relation("ThreadReplies")
  forwarded_from ChatMessage?       @relation("ForwardedMessages", fields: [forwarded_from_id], references: [id])
  forwards       ChatMessage[]      @relation("ForwardedMessages")
  attachments    ChatMessageAttachment[]
  reactions      ChatReaction[]
  bookmarks      ChatBookmark[]

  @@index([channel_id, created_at, deleted_at])
  @@index([thread_parent_id])
  @@index([channel_id, content_tsvector], type: Gin)   // FTS
  @@map("chat_messages")
}

enum MessageType    { text system file voice video workflow_notification bot }
enum DeliveryStatus { sent delivered read }
```

> **FTS trigger:**
> ```sql
> CREATE INDEX idx_messages_fts ON chat_messages USING GIN (to_tsvector('english', content));
>
> CREATE OR REPLACE FUNCTION messages_tsvector_update() RETURNS trigger AS $$
> BEGIN
>   NEW.content_tsvector := to_tsvector('english', coalesce(NEW.content, ''));
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER trg_messages_tsvector
> BEFORE INSERT OR UPDATE OF content
> ON chat_messages FOR EACH ROW EXECUTE FUNCTION messages_tsvector_update();
> ```

### 2.3 ChatMessageAttachment

```prisma
model ChatMessageAttachment {
  id               String   @id @default(cuid())
  message_id       String
  file_name        String   @db.VarChar(255)
  file_size        BigInt
  mime_type        String   @db.VarChar(127)
  storage_path     String   @db.VarChar(1000)  // MinIO object key
  thumbnail_path   String?  @db.VarChar(1000)  // MinIO thumbnail key (images/video)
  duration_seconds Int?                         // Voice / video duration
  width            Int?
  height           Int?
  created_at       DateTime @default(now())

  message ChatMessage @relation(fields: [message_id], references: [id], onDelete: Cascade)

  @@index([message_id])
  @@map("chat_message_attachments")
}
```

### 2.4 ChatReaction

```prisma
model ChatReaction {
  id         String   @id @default(cuid())
  message_id String
  user_id    String
  emoji      String   @db.VarChar(50)  // "👍" or "thumbsup"
  created_at DateTime @default(now())

  message ChatMessage @relation(fields: [message_id], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([message_id, user_id, emoji])
  @@index([message_id])
  @@map("chat_reactions")
}
```

### 2.5 ChatUserStatus

```prisma
model ChatUserStatus {
  id                String     @id @default(cuid())
  user_id           String     @unique
  status            UserStatus @default(offline)
  status_text       String?    @db.VarChar(100)
  status_emoji      String?    @db.VarChar(50)
  status_expires_at DateTime?
  dnd_until         DateTime?
  last_seen_at      DateTime   @default(now())
  created_at        DateTime   @default(now())
  updated_at        DateTime   @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("chat_user_statuses")
}

enum UserStatus { online away dnd offline }
```

### 2.6 ChatMembership (upgrade)

```prisma
model ChatMembership {
  id                       String               @id @default(cuid())
  channel_id               String
  user_id                  String
  role                     MembershipRole       @default(member)
  last_read_message_id     String?              @db.VarChar(36)
  last_read_at             DateTime?
  notification_preference  NotifPreference      @default(all)
  is_muted                 Boolean              @default(false)
  muted_until              DateTime?
  is_starred               Boolean              @default(false)
  joined_at                DateTime             @default(now())
  updated_at               DateTime             @updatedAt

  channel ChatChannel @relation(fields: [channel_id], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([channel_id, user_id])
  @@index([user_id, is_starred])
  @@map("chat_memberships")
}

enum MembershipRole  { owner admin member guest }
enum NotifPreference { all mentions nothing }
```

### 2.7 ChatBookmark

```prisma
model ChatBookmark {
  id         String   @id @default(cuid())
  user_id    String
  message_id String
  note       String?  @db.VarChar(500)
  created_at DateTime @default(now())

  user    User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  message ChatMessage @relation(fields: [message_id], references: [id], onDelete: Cascade)

  @@unique([user_id, message_id])
  @@map("chat_bookmarks")
}
```

### 2.8 ChatScheduledMessage

```prisma
model ChatScheduledMessage {
  id           String           @id @default(cuid())
  channel_id   String
  user_id      String
  content      String           @db.Text
  attachments  Json?            @db.JsonB
  scheduled_at DateTime
  sent_at      DateTime?
  status       ScheduledStatus  @default(pending)
  created_at   DateTime         @default(now())

  channel ChatChannel @relation(fields: [channel_id], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [user_id], references: [id])

  @@index([status, scheduled_at])
  @@map("chat_scheduled_messages")
}

enum ScheduledStatus { pending sent cancelled }
```

### 2.9 ChatIncomingWebhook

```prisma
model ChatIncomingWebhook {
  id           String   @id @default(cuid())
  org_id       String
  channel_id   String
  name         String   @db.VarChar(200)
  description  String?  @db.VarChar(500)
  token        String   @unique @db.VarChar(64)
  icon_url     String?  @db.VarChar(500)
  username     String?  @db.VarChar(100)
  is_active    Boolean  @default(true)
  post_count   Int      @default(0)
  last_used_at DateTime?
  created_by   String   @db.VarChar(36)
  created_at   DateTime @default(now())

  org     Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  channel ChatChannel  @relation(fields: [channel_id], references: [id], onDelete: Cascade)

  @@index([org_id])
  @@map("chat_incoming_webhooks")
}
```

### 2.10 ChatBotIntegration

```prisma
model ChatBotIntegration {
  id              String  @id @default(cuid())
  org_id          String
  name            String  @db.VarChar(200)
  bot_type        BotType @default(custom)
  avatar_url      String? @db.VarChar(500)
  description     String? @db.Text
  command_prefix  String? @db.VarChar(20)   // e.g. "/zenbot"
  slash_commands  Json?   @db.JsonB
  // slash_commands: [{command: "help", description: "Show help", params: [{name:"topic", required:false}]}]
  is_active       Boolean @default(true)
  channels        String[]                  // Channel IDs this bot is active in
  created_by      String  @db.VarChar(36)
  created_at      DateTime @default(now())

  org Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)

  @@map("chat_bot_integrations")
}

enum BotType { workflow zenflow_system custom }
```

### 2.11 ChatCall

```prisma
model ChatCall {
  id               String     @id @default(cuid())
  org_id           String
  channel_id       String?
  initiator_id     String
  call_type        CallType
  status           CallStatus @default(ringing)
  participants     Json       @db.JsonB
  // participants: [{user_id, joined_at, left_at, status: "active"|"ended"|"missed"}]
  started_at       DateTime?
  ended_at         DateTime?
  duration_seconds Int?
  recording_url    String?    @db.VarChar(500)
  created_at       DateTime   @default(now())

  org       Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  channel   ChatChannel? @relation(fields: [channel_id], references: [id])
  initiator User         @relation(fields: [initiator_id], references: [id])

  @@index([org_id, status])
  @@map("chat_calls")
}

enum CallType   { audio video screen_share }
enum CallStatus { ringing active ended missed declined }
```

---

## 3. tRPC Router

### `apps/web/src/server/api/routers/chat.ts`

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { io } from "@/lib/socket-server";

// ── Cursor pagination helper ────────────────────────────────────────────────

const cursorPagination = z.object({
  limit:  z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),   // message ID used as cursor
  direction: z.enum(["before","after"]).default("before"),
});

// ── Router ─────────────────────────────────────────────────────────────────

export const chatRouter = createTRPCRouter({

  // ── Channels ───────────────────────────────────────────────────────────────

  "channels.list": protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.chatMembership.findMany({
      where: { user_id: ctx.user.id },
      include: {
        channel: {
          select: {
            id: true, name: true, type: true, icon: true, topic: true,
            last_message_at: true, message_count: true, member_count: true,
            is_archived: true,
          },
        },
      },
      orderBy: [{ is_starred: "desc" }, { channel: { last_message_at: "desc" } }],
    });
    return memberships;
  }),

  "channels.create": protectedProcedure
    .input(z.object({
      name:        z.string().min(1).max(200),
      type:        z.enum(["public","private"]).default("public"),
      description: z.string().optional(),
      topic:       z.string().optional(),
      icon:        z.string().optional(),
      member_ids:  z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { member_ids, ...channelData } = input;
      const channel = await db.chatChannel.create({
        data: {
          ...channelData,
          org_id:     ctx.org.id,
          created_by: ctx.user.id,
          member_count: (member_ids?.length ?? 0) + 1,
          memberships: {
            create: [
              { user_id: ctx.user.id, role: "owner" },
              ...(member_ids ?? []).map(uid => ({ user_id: uid, role: "member" as const })),
            ],
          },
        },
      });
      return channel;
    }),

  "channels.join": protectedProcedure
    .input(z.object({ channel_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.chatMembership.upsert({
        where: { channel_id_user_id: { channel_id: input.channel_id, user_id: ctx.user.id } },
        create: { channel_id: input.channel_id, user_id: ctx.user.id },
        update: {},
      });
      await db.chatChannel.update({ where: { id: input.channel_id }, data: { member_count: { increment: 1 } } });
    }),

  "channels.leave": protectedProcedure
    .input(z.object({ channel_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.chatMembership.delete({
        where: { channel_id_user_id: { channel_id: input.channel_id, user_id: ctx.user.id } },
      });
      await db.chatChannel.update({ where: { id: input.channel_id }, data: { member_count: { decrement: 1 } } });
    }),

  "channels.archive": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.chatChannel.update({
        where: { id: input.id },
        data: { is_archived: true, archived_at: new Date(), archived_by: ctx.user.id },
      });
    }),

  "channels.members": protectedProcedure
    .input(z.object({ channel_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.chatMembership.findMany({
        where: { channel_id: input.channel_id },
        include: {
          user: {
            select: { id: true, name: true, avatar_url: true },
            include: { chat_status: true },
          },
        },
      });
    }),

  // ── Messages ───────────────────────────────────────────────────────────────

  "messages.list": protectedProcedure
    .input(cursorPagination.extend({ channel_id: z.string(), thread_parent_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const messages = await db.chatMessage.findMany({
        where: {
          channel_id:       input.channel_id,
          thread_parent_id: input.thread_parent_id ?? null,
          deleted_at:       null,
          ...(input.cursor && input.direction === "before" && { created_at: { lt: new Date(input.cursor) } }),
          ...(input.cursor && input.direction === "after"  && { created_at: { gt: new Date(input.cursor) } }),
        },
        orderBy:  { created_at: input.direction === "before" ? "desc" : "asc" },
        take:     input.limit,
        include: {
          author:      { select: { id: true, name: true, avatar_url: true } },
          attachments: true,
          reactions:   { include: { user: { select: { id: true, name: true } } } },
        },
      });
      return { messages: input.direction === "before" ? messages.reverse() : messages };
    }),

  "messages.send": protectedProcedure
    .input(z.object({
      channel_id:       z.string(),
      content:          z.string().min(1),
      thread_parent_id: z.string().optional(),
      message_type:     z.enum(["text","file","voice","video"]).default("text"),
      metadata:         z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = await db.chatMessage.create({
        data: {
          channel_id:       input.channel_id,
          user_id:          ctx.user.id,
          content:          input.content,
          thread_parent_id: input.thread_parent_id,
          message_type:     input.message_type,
          metadata:         input.metadata,
        },
        include: {
          author: { select: { id: true, name: true, avatar_url: true } },
          attachments: true,
        },
      });

      // Update channel cache
      await db.chatChannel.update({
        where: { id: input.channel_id },
        data:  { last_message_id: message.id, last_message_at: message.created_at, message_count: { increment: 1 } },
      });

      // Update thread parent stats
      if (input.thread_parent_id) {
        await db.chatMessage.update({
          where: { id: input.thread_parent_id },
          data: {
            thread_reply_count:  { increment: 1 },
            thread_last_reply_at: message.created_at,
            thread_participant_ids: { push: ctx.user.id },
          },
        });
      }

      // Parse @mentions and notify
      const mentionedIds = parseMentions(input.content);
      if (mentionedIds.length > 0) {
        await enqueueMentionNotifications(mentionedIds, message, ctx.org.id);
      }

      // Emit via Socket.io to all members of the channel room
      io.to(`channel:${input.channel_id}`).emit("new_message", message);

      return message;
    }),

  "messages.edit": protectedProcedure
    .input(z.object({ id: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const msg = await db.chatMessage.findUnique({ where: { id: input.id } });
      if (!msg || msg.user_id !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const updated = await db.chatMessage.update({
        where: { id: input.id }, data: { content: input.content, edited_at: new Date() },
      });
      io.to(`channel:${msg.channel_id}`).emit("message_updated", updated);
      return updated;
    }),

  "messages.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await db.chatMessage.findUnique({ where: { id: input.id } });
      if (!msg || msg.user_id !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.chatMessage.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
      io.to(`channel:${msg.channel_id}`).emit("message_deleted", { id: input.id });
    }),

  "messages.pin": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await db.chatMessage.update({
        where: { id: input.id },
        data: { is_pinned: true, pinned_by: ctx.user.id, pinned_at: new Date() },
      });
      await db.chatChannel.update({
        where: { id: msg.channel_id },
        data: { pinned_message_ids: { push: input.id } },
      });
      return msg;
    }),

  "messages.search": protectedProcedure
    .input(z.object({ channel_id: z.string(), query: z.string().min(1), limit: z.number().int().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const tsQuery = input.query.split(/\s+/).map(w => `${w}:*`).join(" & ");
      return db.$queryRaw`
        SELECT id, content, user_id, created_at,
               ts_rank(content_tsvector, to_tsquery('english', ${tsQuery})) AS rank
        FROM chat_messages
        WHERE channel_id = ${input.channel_id}
          AND deleted_at IS NULL
          AND content_tsvector @@ to_tsquery('english', ${tsQuery})
        ORDER BY rank DESC
        LIMIT ${input.limit}
      `;
    }),

  // ── Reactions ─────────────────────────────────────────────────────────────

  "reactions.add": protectedProcedure
    .input(z.object({ message_id: z.string(), emoji: z.string().max(50) }))
    .mutation(async ({ ctx, input }) => {
      await db.chatReaction.create({
        data: { message_id: input.message_id, user_id: ctx.user.id, emoji: input.emoji },
      });
      await refreshReactionSummary(input.message_id);
      const msg = await db.chatMessage.findUnique({ where: { id: input.message_id }, select: { channel_id: true } });
      io.to(`channel:${msg!.channel_id}`).emit("reaction_added", { message_id: input.message_id, emoji: input.emoji, user_id: ctx.user.id });
    }),

  "reactions.remove": protectedProcedure
    .input(z.object({ message_id: z.string(), emoji: z.string().max(50) }))
    .mutation(async ({ ctx, input }) => {
      await db.chatReaction.delete({
        where: { message_id_user_id_emoji: { message_id: input.message_id, user_id: ctx.user.id, emoji: input.emoji } },
      });
      await refreshReactionSummary(input.message_id);
    }),

  // ── Threads ───────────────────────────────────────────────────────────────

  "threads.get": protectedProcedure
    .input(cursorPagination.extend({ parent_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const parent = await db.chatMessage.findUnique({
        where: { id: input.parent_id },
        include: { author: { select: { id: true, name: true, avatar_url: true } }, attachments: true },
      });
      if (!parent) throw new TRPCError({ code: "NOT_FOUND" });
      const replies = await db.chatMessage.findMany({
        where: { thread_parent_id: input.parent_id, deleted_at: null,
                 ...(input.cursor && { created_at: { gt: new Date(input.cursor) } }) },
        orderBy:  { created_at: "asc" },
        take:     input.limit,
        include: { author: { select: { id: true, name: true, avatar_url: true } }, attachments: true, reactions: true },
      });
      return { parent, replies };
    }),

  // ── Bookmarks ─────────────────────────────────────────────────────────────

  "bookmarks.save": protectedProcedure
    .input(z.object({ message_id: z.string(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.chatBookmark.upsert({
        where: { user_id_message_id: { user_id: ctx.user.id, message_id: input.message_id } },
        create: { user_id: ctx.user.id, message_id: input.message_id, note: input.note },
        update: { note: input.note },
      });
    }),

  "bookmarks.remove": protectedProcedure
    .input(z.object({ message_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.chatBookmark.delete({
        where: { user_id_message_id: { user_id: ctx.user.id, message_id: input.message_id } },
      });
    }),

  "bookmarks.list": protectedProcedure
    .input(z.object({ limit: z.number().int().max(100).default(20), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return db.chatBookmark.findMany({
        where: { user_id: ctx.user.id,
                 ...(input.cursor && { created_at: { lt: new Date(input.cursor) } }) },
        take: input.limit,
        orderBy: { created_at: "desc" },
        include: { message: { include: { author: { select: { id: true, name: true, avatar_url: true } } } } },
      });
    }),

  // ── Status ────────────────────────────────────────────────────────────────

  "status.set": protectedProcedure
    .input(z.object({
      status:           z.enum(["online","away","dnd","offline"]),
      status_text:      z.string().max(100).optional(),
      status_emoji:     z.string().max(50).optional(),
      expires_in_minutes: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { expires_in_minutes, ...rest } = input;
      const expiresAt = expires_in_minutes ? new Date(Date.now() + expires_in_minutes * 60_000) : null;
      const status = await db.chatUserStatus.upsert({
        where: { user_id: ctx.user.id },
        create: { user_id: ctx.user.id, ...rest, status_expires_at: expiresAt, last_seen_at: new Date() },
        update: { ...rest, status_expires_at: expiresAt, last_seen_at: new Date() },
      });
      // Broadcast presence update to all channels the user is in
      io.to(`user:${ctx.user.id}`).emit("status_changed", status);
      return status;
    }),

  "status.get": protectedProcedure
    .input(z.object({ user_ids: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      return db.chatUserStatus.findMany({
        where: { user_id: { in: input.user_ids } },
      });
    }),

  // ── Scheduled messages ────────────────────────────────────────────────────

  "scheduled.create": protectedProcedure
    .input(z.object({
      channel_id:   z.string(),
      content:      z.string().min(1),
      scheduled_at: z.string().datetime(),
      attachments:  z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.chatScheduledMessage.create({
        data: {
          channel_id:   input.channel_id,
          user_id:      ctx.user.id,
          content:      input.content,
          attachments:  input.attachments,
          scheduled_at: new Date(input.scheduled_at),
        },
      });
    }),

  "scheduled.cancel": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.chatScheduledMessage.update({
        where: { id: input.id, user_id: ctx.user.id },
        data:  { status: "cancelled" },
      });
    }),

  // ── Webhooks ──────────────────────────────────────────────────────────────

  "webhooks.create": protectedProcedure
    .input(z.object({
      channel_id:  z.string(),
      name:        z.string().min(1).max(200),
      description: z.string().optional(),
      icon_url:    z.string().url().optional(),
      username:    z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.chatIncomingWebhook.create({
        data: {
          ...input,
          org_id:     ctx.org.id,
          token:      generateSecureToken(64),
          created_by: ctx.user.id,
        },
      });
    }),

  "webhooks.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.chatIncomingWebhook.update({ where: { id: input.id }, data: { is_active: false } });
    }),

  // ── Calls ─────────────────────────────────────────────────────────────────

  "calls.initiate": protectedProcedure
    .input(z.object({ channel_id: z.string().optional(), call_type: z.enum(["audio","video","screen_share"]), invitee_ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const call = await db.chatCall.create({
        data: {
          org_id:       ctx.org.id,
          channel_id:   input.channel_id,
          initiator_id: ctx.user.id,
          call_type:    input.call_type,
          status:       "ringing",
          participants: [{ user_id: ctx.user.id, joined_at: new Date().toISOString(), status: "active" }],
        },
      });
      // Notify invitees via socket
      input.invitee_ids.forEach(uid => {
        io.to(`user:${uid}`).emit("incoming_call", { call, from: ctx.user });
      });
      return call;
    }),

  "calls.end": protectedProcedure
    .input(z.object({ call_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const call = await db.chatCall.findUniqueOrThrow({ where: { id: input.call_id } });
      const duration = call.started_at ? Math.floor((now.getTime() - call.started_at.getTime()) / 1000) : 0;
      return db.chatCall.update({
        where: { id: input.call_id },
        data:  { status: "ended", ended_at: now, duration_seconds: duration },
      });
    }),

  // ── Global search ─────────────────────────────────────────────────────────

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().int().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const tsQuery = input.query.split(/\s+/).map(w => `${w}:*`).join(" & ");
      return db.$queryRaw`
        SELECT m.id, m.content, m.channel_id, m.user_id, m.created_at,
               c.name AS channel_name,
               ts_rank(m.content_tsvector, to_tsquery('english', ${tsQuery})) AS rank
        FROM chat_messages m
        JOIN chat_channels c ON c.id = m.channel_id
        JOIN chat_memberships mb ON mb.channel_id = m.channel_id AND mb.user_id = ${ctx.user.id}
        WHERE c.org_id = ${ctx.org.id}
          AND m.deleted_at IS NULL
          AND m.content_tsvector @@ to_tsquery('english', ${tsQuery})
        ORDER BY rank DESC
        LIMIT ${input.limit}
      `;
    }),
});
```

---

## 4. Incoming Webhook HTTP Handler

### `apps/web/src/app/api/chat/webhooks/[token]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { io } from "@/lib/socket-server";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const webhook = await db.chatIncomingWebhook.findFirst({
    where: { token: params.token, is_active: true },
  });
  if (!webhook) return NextResponse.json({ error: "Invalid webhook token" }, { status: 404 });

  const body = await req.json();
  const content = body.text ?? body.content;
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  const message = await db.chatMessage.create({
    data: {
      channel_id:   webhook.channel_id,
      user_id:      webhook.created_by,
      content,
      message_type: "bot",
      metadata:     { webhook_name: webhook.username ?? webhook.name, icon_url: webhook.icon_url },
    },
  });

  await db.chatIncomingWebhook.update({
    where: { id: webhook.id },
    data:  { post_count: { increment: 1 }, last_used_at: new Date() },
  });

  io.to(`channel:${webhook.channel_id}`).emit("new_message", message);

  return NextResponse.json({ ok: true, message_id: message.id });
}
```

---

## 5. Real-time Architecture

### 5.1 Socket.io server: `apps/web/src/lib/socket-server.ts`

```typescript
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { verifyJwt } from "@/lib/auth";

let io: Server;

export async function initSocketServer(httpServer: any) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  io = new Server(httpServer, {
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL },
    adapter: createAdapter(pubClient, subClient),
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string;
    try {
      const user = await verifyJwt(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const { user } = socket.data;

    // Join user's personal room
    await socket.join(`user:${user.id}`);

    // Join all channel rooms the user is a member of
    const memberships = await db.chatMembership.findMany({
      where: { user_id: user.id }, select: { channel_id: true },
    });
    for (const m of memberships) {
      await socket.join(`channel:${m.channel_id}`);
    }

    // Mark user online
    await db.chatUserStatus.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, status: "online", last_seen_at: new Date() },
      update: { status: "online", last_seen_at: new Date() },
    });

    socket.on("typing_start", (data) => {
      socket.to(`channel:${data.channel_id}`).emit("user_typing", { user_id: user.id, channel_id: data.channel_id });
    });
    socket.on("typing_stop", (data) => {
      socket.to(`channel:${data.channel_id}`).emit("user_stopped_typing", { user_id: user.id });
    });
    socket.on("mark_read", async (data) => {
      await db.chatMembership.update({
        where: { channel_id_user_id: { channel_id: data.channel_id, user_id: user.id } },
        data:  { last_read_message_id: data.message_id, last_read_at: new Date() },
      });
    });

    socket.on("disconnect", async () => {
      await db.chatUserStatus.update({
        where: { user_id: user.id },
        data:  { status: "offline", last_seen_at: new Date() },
      });
    });
  });

  return io;
}

export { io };
```

### 5.2 Unread count query

```typescript
// Get unread counts for all channels the user belongs to
export async function getUnreadCounts(userId: string, orgId: string) {
  return db.$queryRaw<Array<{ channel_id: string; unread_count: bigint }>>`
    SELECT m.channel_id,
           COUNT(m.id) AS unread_count
    FROM chat_messages m
    JOIN chat_memberships mb ON mb.channel_id = m.channel_id AND mb.user_id = ${userId}
    WHERE m.created_at > COALESCE(mb.last_read_at, '1970-01-01')
      AND m.deleted_at IS NULL
      AND m.user_id != ${userId}
    GROUP BY m.channel_id
  `;
}
```

---

## 6. Business Logic

### 6.1 Reaction summary refresh

```typescript
async function refreshReactionSummary(messageId: string) {
  const reactions = await db.chatReaction.groupBy({
    by: ["emoji"],
    where: { message_id: messageId },
    _count: { emoji: true },
  });
  const summary = Object.fromEntries(reactions.map(r => [r.emoji, r._count.emoji]));
  await db.chatMessage.update({ where: { id: messageId }, data: { reactions_summary: summary } });
}
```

### 6.2 Mention parser

```typescript
export function parseMentions(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;  // @[Name](userId) markdown-style
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[2]);
  }
  return [...new Set(ids)];
}
```

### 6.3 Scheduled message BullMQ worker

```typescript
// apps/web/src/workers/scheduled-messages.worker.ts
import { Worker } from "bullmq";
import { db } from "@/server/db";
import { io } from "@/lib/socket-server";
import { redis } from "@/lib/redis";

new Worker("scheduled-messages", async (job) => {
  const pending = await db.chatScheduledMessage.findMany({
    where: { status: "pending", scheduled_at: { lte: new Date() } },
  });
  for (const sm of pending) {
    const message = await db.chatMessage.create({
      data: { channel_id: sm.channel_id, user_id: sm.user_id, content: sm.content, message_type: "text" },
    });
    await db.chatScheduledMessage.update({ where: { id: sm.id }, data: { status: "sent", sent_at: new Date() } });
    io.to(`channel:${sm.channel_id}`).emit("new_message", message);
  }
}, { connection: redis });
```

### 6.4 Message retention policy worker

```typescript
// apps/web/src/workers/message-retention.worker.ts
import { Worker } from "bullmq";
import { db } from "@/server/db";

new Worker("message-retention", async () => {
  const channels = await db.chatChannel.findMany({
    where: { retention_days: { not: null } },
    select: { id: true, retention_days: true },
  });
  for (const ch of channels) {
    const cutoff = new Date(Date.now() - ch.retention_days! * 86_400_000);
    await db.chatMessage.deleteMany({
      where: { channel_id: ch.id, created_at: { lt: cutoff }, is_pinned: false },
    });
  }
}, { connection: redis });
```

### 6.5 File upload with thumbnail generation

```typescript
// apps/web/src/lib/chat-upload.ts
import sharp from "sharp";
import { s3 } from "@/lib/minio";

export async function uploadChatFile(
  file: Buffer,
  fileName: string,
  mimeType: string,
  messageId: string,
): Promise<{ storage_path: string; thumbnail_path?: string }> {
  const key = `chat/${messageId}/${fileName}`;
  await s3.putObject("zenflow", key, file, file.length, { "Content-Type": mimeType });

  let thumbnailPath: string | undefined;
  if (mimeType.startsWith("image/")) {
    const thumb = await sharp(file).resize(320, 240, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
    thumbnailPath = `chat/${messageId}/thumb_${fileName}`;
    await s3.putObject("zenflow", thumbnailPath, thumb, thumb.length, { "Content-Type": "image/jpeg" });
  }

  return { storage_path: key, thumbnail_path: thumbnailPath };
}
```

---

## 7. Files Structure

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── chat/
│   │       ├── layout.tsx                          # Socket provider, channel list sidebar
│   │       ├── page.tsx                            # Channel browser / empty state
│   │       ├── [channelId]/
│   │       │   ├── page.tsx                        # Message list + composer
│   │       │   └── threads/
│   │       │       └── [threadId]/page.tsx         # Thread detail panel
│   │       └── search/page.tsx                     # Global chat search
│   └── api/
│       └── chat/
│           └── webhooks/
│               └── [token]/route.ts                # Incoming webhook handler
├── components/
│   └── chat/
│       ├── MessageList.tsx                         # Virtualized with @tanstack/react-virtual
│       ├── MessageItem.tsx                         # Individual message + thread + reactions
│       ├── MessageComposer.tsx                     # Rich text, @mention, file, emoji
│       ├── ThreadPanel.tsx                         # Slide-in thread detail
│       ├── ReactionPicker.tsx                      # emoji-mart picker
│       ├── UserPresence.tsx                        # Online dot, status tooltip
│       ├── ChannelSearch.tsx                       # Full-text search within a channel
│       ├── CallWidget.tsx                          # Floating active call bar
│       ├── BookmarksPanel.tsx                      # Saved messages drawer
│       ├── PinnedMessages.tsx                      # Pinned message list
│       └── ScheduledMessagesDialog.tsx
└── lib/
    ├── socket-server.ts                            # Socket.io + Redis adapter
    └── chat-upload.ts                              # MinIO upload + thumbnail
```

---

## 8. npm Packages

```json
{
  "socket.io": "^4.x",
  "socket.io-client": "^4.x",
  "@socket.io/redis-adapter": "^8.x",
  "@tanstack/react-virtual": "^3.x",
  "emoji-mart": "^5.x",
  "@emoji-mart/data": "^1.x",
  "@emoji-mart/react": "^1.x",
  "date-fns-tz": "^2.x",
  "sharp": "^0.x"
}
```

---

## 9. Environment Variables

```bash
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=zenflow
```
