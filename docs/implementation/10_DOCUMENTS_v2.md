# 10 — Documents v2 Implementation (Notion-like)

**Stack:** Next.js 15 App Router · TypeScript 5 · tRPC v11 · Prisma v6 · PostgreSQL 16 · Yjs · Tiptap v2 · MinIO · BullMQ

---

## 1. Overview

Documents v2 gives ZenFlow a fully-featured knowledge base that works like Notion: nested pages, real-time collaborative editing, rich content blocks, comments anchored to specific text selections, version history with visual diffs, granular sharing/permissions, and a template gallery. Every document lives inside a DocSpace (top-level namespace), can be nested to arbitrary depth, and can be linked back to CRM contacts, HR employees, helpdesk tickets, and other entities.

---

## 2. Database Schema

### 2.1 DocSpace

```prisma
model DocSpace {
  id          String   @id @default(cuid())
  org_id      String
  name        String   @db.VarChar(200)
  icon        String?  @db.VarChar(100)   // emoji ("📄") or lucide icon name ("file-text")
  color       String?  @db.VarChar(7)     // hex "#6366f1"
  description String?  @db.Text
  visibility  DocSpaceVisibility @default(org)
  owner_id    String
  team_id     String?
  position    Int      @default(0)
  is_archived Boolean  @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  org         Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  owner       User         @relation("SpaceOwner", fields: [owner_id], references: [id])
  team        Team?        @relation(fields: [team_id], references: [id])
  documents   Document[]

  @@index([org_id, owner_id])
  @@index([org_id, visibility])
  @@map("doc_spaces")
}

enum DocSpaceVisibility {
  private
  team
  org
}
```

### 2.2 Document

```prisma
model Document {
  id                    String    @id @default(cuid())
  org_id                String
  space_id              String?
  parent_doc_id         String?
  title                 String    @default("Untitled") @db.VarChar(500)
  icon                  String?   @db.VarChar(100)
  cover_image_url       String?   @db.VarChar(500)
  content               Json?     @db.JsonB   // Full Tiptap ProseMirror JSON document
  content_text          String?   @db.Text    // Stripped plain text for FTS
  content_tsvector      Unsupported("tsvector")?  // FTS index column
  word_count            Int       @default(0)
  reading_time_minutes  Int       @default(0)
  visibility            DocVisibility @default(org)
  published_at          DateTime?
  is_template           Boolean   @default(false)
  template_category     String?   @db.VarChar(100)
  is_archived           Boolean   @default(false)
  archived_at           DateTime?
  is_locked             Boolean   @default(false)
  locked_by             String?   @db.VarChar(36)
  lock_reason           String?   @db.VarChar(255)
  breadcrumb_path       String?   @db.Text   // Cached: "Space / Parent / This Doc"
  position              Int       @default(0)
  views_count           Int       @default(0)
  last_viewed_at        DateTime?
  share_token           String?   @unique @db.VarChar(64)
  share_expires_at      DateTime?
  share_can_edit        Boolean   @default(false)
  created_by            String    @db.VarChar(36)
  updated_by            String?   @db.VarChar(36)
  deleted_at            DateTime?
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  org          Organization  @relation(fields: [org_id], references: [id], onDelete: Cascade)
  space        DocSpace?     @relation(fields: [space_id], references: [id])
  parent       Document?     @relation("DocHierarchy", fields: [parent_doc_id], references: [id])
  children     Document[]    @relation("DocHierarchy")
  versions     DocVersion[]
  comments     DocComment[]
  favorites    DocFavorite[]
  permissions  DocPermission[]
  outboundLinks DocLink[]    @relation("SourceDoc")
  inboundLinks  DocLink[]    @relation("TargetDoc")
  collaborators DocCollaborator[]
  creator      User          @relation("DocCreator", fields: [created_by], references: [id])

  @@index([org_id, space_id, parent_doc_id, deleted_at])
  @@index([share_token])
  @@index([org_id, is_template])
  @@index([org_id, content_tsvector], type: Gin)  // Full-text search
  @@map("documents")
}

enum DocVisibility {
  private
  team
  org
  public
}
```

> **Migration note:** After adding `content_tsvector`, create a PostgreSQL trigger to auto-update it from `content_text`:
> ```sql
> CREATE INDEX idx_documents_fts ON documents USING GIN (content_tsvector);
>
> CREATE OR REPLACE FUNCTION documents_tsvector_update() RETURNS trigger AS $$
> BEGIN
>   NEW.content_tsvector := to_tsvector('english',
>     coalesce(NEW.title, '') || ' ' || coalesce(NEW.content_text, '')
>   );
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER trg_documents_tsvector
> BEFORE INSERT OR UPDATE OF title, content_text
> ON documents FOR EACH ROW EXECUTE FUNCTION documents_tsvector_update();
> ```

### 2.3 DocVersion

```prisma
model DocVersion {
  id             String   @id @default(cuid())
  document_id    String
  version_number Int
  title          String   @db.VarChar(500)
  content        Json     @db.JsonB
  content_text   String?  @db.Text
  changed_by     String   @db.VarChar(36)
  change_summary String?  @db.VarChar(255)
  is_named       Boolean  @default(false)
  version_name   String?  @db.VarChar(100)
  created_at     DateTime @default(now())

  document Document @relation(fields: [document_id], references: [id], onDelete: Cascade)
  author   User     @relation(fields: [changed_by], references: [id])

  @@unique([document_id, version_number])
  @@index([document_id, version_number])
  @@map("doc_versions")
}
```

### 2.4 DocComment

```prisma
model DocComment {
  id                String    @id @default(cuid())
  document_id       String
  parent_comment_id String?
  block_id          String?   @db.VarChar(36)     // ProseMirror node id
  selected_text     String?   @db.VarChar(500)    // Quoted text being annotated
  content           String    @db.Text
  content_html      String?   @db.Text
  is_resolved       Boolean   @default(false)
  resolved_by       String?   @db.VarChar(36)
  resolved_at       DateTime?
  mentions          String[]  @db.Text            // Array of user IDs
  created_by        String    @db.VarChar(36)
  edited_at         DateTime?
  deleted_at        DateTime?
  created_at        DateTime  @default(now())

  document       Document     @relation(fields: [document_id], references: [id], onDelete: Cascade)
  parent         DocComment?  @relation("CommentThread", fields: [parent_comment_id], references: [id])
  replies        DocComment[] @relation("CommentThread")
  author         User         @relation(fields: [created_by], references: [id])

  @@index([document_id, is_resolved])
  @@map("doc_comments")
}
```

### 2.5 DocFavorite

```prisma
model DocFavorite {
  id          String   @id @default(cuid())
  user_id     String
  document_id String
  created_at  DateTime @default(now())

  user     User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  document Document @relation(fields: [document_id], references: [id], onDelete: Cascade)

  @@unique([user_id, document_id])
  @@map("doc_favorites")
}
```

### 2.6 DocPermission

```prisma
model DocPermission {
  id               String          @id @default(cuid())
  document_id      String
  subject_type     PermSubjectType
  subject_id       String?         @db.VarChar(36)  // null when subject_type = public
  permission_level PermLevel
  granted_by       String          @db.VarChar(36)
  created_at       DateTime        @default(now())

  document Document @relation(fields: [document_id], references: [id], onDelete: Cascade)
  granter  User     @relation("PermGranter", fields: [granted_by], references: [id])

  @@unique([document_id, subject_type, subject_id])
  @@map("doc_permissions")
}

enum PermSubjectType { user team public }
enum PermLevel       { view comment edit manage }
```

### 2.7 DocLink

```prisma
model DocLink {
  id                  String    @id @default(cuid())
  source_document_id  String
  target_document_id  String?
  target_entity_type  String?   @db.VarChar(50)  // crm_contact | hr_employee | helpdesk_ticket
  target_entity_id    String?   @db.VarChar(36)
  link_type           LinkType
  block_id            String    @db.VarChar(36)
  created_at          DateTime  @default(now())

  source Document  @relation("SourceDoc", fields: [source_document_id], references: [id], onDelete: Cascade)
  target Document? @relation("TargetDoc", fields: [target_document_id], references: [id])

  @@index([target_document_id])
  @@index([target_entity_type, target_entity_id])
  @@map("doc_links")
}

enum LinkType { mention embed backlink }
```

### 2.8 DocCollaborator (real-time presence)

```prisma
model DocCollaborator {
  id              String    @id @default(cuid())
  document_id     String
  user_id         String
  socket_id       String    @db.VarChar(100)
  cursor_position Json?     @db.JsonB  // {anchor: number, head: number}
  color           String    @db.VarChar(7)
  last_seen_at    DateTime  @updatedAt
  created_at      DateTime  @default(now())

  document Document @relation(fields: [document_id], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([document_id, user_id])
  @@map("doc_collaborators")
}
```

---

## 3. Tiptap Content JSON Structure

Every document's `content` column stores a ProseMirror JSON document. The root is always a `doc` node. Below is the canonical schema for every supported block type.

### 3.1 Root document envelope

```json
{
  "type": "doc",
  "content": [ /* array of block nodes */ ]
}
```

### 3.2 Block node catalog

```json
// paragraph
{ "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }

// heading
{ "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Title" }] }
// level: 1 | 2 | 3

// bulletList / orderedList
{
  "type": "bulletList",
  "content": [
    { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item" }] }] }
  ]
}

// taskList
{
  "type": "taskList",
  "content": [
    { "type": "taskItem", "attrs": { "checked": false }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "To-do" }] }] }
  ]
}

// blockquote
{ "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Quote" }] }] }

// codeBlock
{ "type": "codeBlock", "attrs": { "language": "typescript" }, "content": [{ "type": "text", "text": "const x = 1;" }] }

// image
{
  "type": "image",
  "attrs": { "src": "https://...", "alt": "Description", "caption": "Figure 1", "width": 800, "height": 600 }
}

// table
{
  "type": "table",
  "content": [
    {
      "type": "tableRow",
      "content": [
        { "type": "tableHeader", "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Col A" }] }] }
      ]
    },
    {
      "type": "tableRow",
      "content": [
        { "type": "tableCell", "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Value" }] }] }
      ]
    }
  ]
}

// horizontalRule
{ "type": "horizontalRule" }

// callout (custom node)
{
  "type": "callout",
  "attrs": { "type": "info", "icon": "💡" },
  "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Note here" }] }]
}
// callout.attrs.type: info | warning | success | error

// toggle (details/summary pattern)
{
  "type": "toggle",
  "attrs": { "open": false },
  "content": [
    { "type": "toggleSummary", "content": [{ "type": "text", "text": "Click to expand" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Hidden content" }] }
  ]
}

// mathBlock (LaTeX via KaTeX)
{ "type": "mathBlock", "attrs": { "latex": "E = mc^2" } }

// youtube embed (node view)
{ "type": "youtube", "attrs": { "src": "https://www.youtube.com/watch?v=...", "width": 640, "height": 360 } }

// mermaid diagram (node view)
{ "type": "mermaid", "attrs": { "code": "graph TD; A-->B;" } }

// mention
{ "type": "mention", "attrs": { "kind": "user", "id": "user_abc123", "label": "Jane Smith" } }
// mention.attrs.kind: user | doc | date
// For doc: id = document id, label = document title
// For date: id = ISO date string, label = formatted display

// hardBreak
{ "type": "hardBreak" }
```

### 3.3 Inline marks

```json
// text with marks
{
  "type": "text",
  "text": "Bold italic",
  "marks": [
    { "type": "bold" },
    { "type": "italic" },
    { "type": "underline" },
    { "type": "strike" },
    { "type": "code" },
    { "type": "link", "attrs": { "href": "https://...", "target": "_blank" } },
    { "type": "highlight", "attrs": { "color": "#fef08a" } },
    { "type": "textStyle", "attrs": { "color": "#ef4444", "fontSize": "14px" } }
  ]
}
```

---

## 4. tRPC Router

### 4.1 Router file: `apps/web/src/server/api/routers/documents.ts`

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { Prisma } from "@prisma/client";

// ── Shared validators ──────────────────────────────────────────────────────────

const docContentSchema = z.object({ type: z.literal("doc"), content: z.array(z.any()) });

const createDocInput = z.object({
  space_id:        z.string().optional(),
  parent_doc_id:   z.string().optional(),
  title:           z.string().max(500).default("Untitled"),
  icon:            z.string().max(100).optional(),
  cover_image_url: z.string().url().optional(),
  content:         docContentSchema.optional(),
  visibility:      z.enum(["private","team","org","public"]).default("org"),
  is_template:     z.boolean().default(false),
  template_category: z.string().optional(),
  position:        z.number().int().optional(),
});

// ── Router ─────────────────────────────────────────────────────────────────────

export const documentsRouter = createTRPCRouter({

  // ── Spaces ──────────────────────────────────────────────────────────────────

  "spaces.list": protectedProcedure.query(async ({ ctx }) => {
    return db.docSpace.findMany({
      where: { org_id: ctx.org.id, is_archived: false },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
  }),

  "spaces.create": protectedProcedure
    .input(z.object({
      name:        z.string().min(1).max(200),
      icon:        z.string().optional(),
      color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      description: z.string().optional(),
      visibility:  z.enum(["private","team","org"]).default("org"),
      team_id:     z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.docSpace.create({
        data: { ...input, org_id: ctx.org.id, owner_id: ctx.user.id },
      });
    }),

  "spaces.update": protectedProcedure
    .input(z.object({ id: z.string(), data: z.object({
      name: z.string().max(200).optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      description: z.string().optional(),
      visibility: z.enum(["private","team","org"]).optional(),
      position: z.number().int().optional(),
    })}))
    .mutation(async ({ ctx, input }) => {
      await assertSpaceAccess(ctx, input.id, "manage");
      return db.docSpace.update({ where: { id: input.id }, data: input.data });
    }),

  "spaces.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSpaceAccess(ctx, input.id, "manage");
      // Soft-archive all documents inside
      await db.document.updateMany({ where: { space_id: input.id }, data: { is_archived: true, archived_at: new Date() } });
      return db.docSpace.update({ where: { id: input.id }, data: { is_archived: true } });
    }),

  // ── Documents ───────────────────────────────────────────────────────────────

  create: protectedProcedure
    .input(createDocInput)
    .mutation(async ({ ctx, input }) => {
      const doc = await db.document.create({
        data: {
          ...input,
          org_id:     ctx.org.id,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        },
      });
      await updateBreadcrumbPath(doc.id);
      return doc;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string(), version_number: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const doc = await db.document.findFirst({
        where: { id: input.id, org_id: ctx.org.id, deleted_at: null },
        include: {
          space: true,
          children: { where: { deleted_at: null }, orderBy: { position: "asc" } },
          permissions: true,
          collaborators: { include: { user: { select: { id: true, name: true, avatar_url: true } } } },
        },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      await assertDocAccess(ctx, doc, "view");

      // Increment view count (fire and forget)
      db.document.update({ where: { id: doc.id }, data: { views_count: { increment: 1 }, last_viewed_at: new Date() } }).catch(() => {});

      if (input.version_number) {
        const version = await db.docVersion.findFirst({ where: { document_id: doc.id, version_number: input.version_number } });
        if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
        return { ...doc, content: version.content, title: version.title, _viewing_version: input.version_number };
      }
      return doc;
    }),

  update: protectedProcedure
    .input(z.object({
      id:              z.string(),
      title:           z.string().max(500).optional(),
      icon:            z.string().optional().nullable(),
      cover_image_url: z.string().url().optional().nullable(),
      content:         docContentSchema.optional(),
      visibility:      z.enum(["private","team","org","public"]).optional(),
      is_locked:       z.boolean().optional(),
      lock_reason:     z.string().optional(),
      position:        z.number().int().optional(),
      space_id:        z.string().optional().nullable(),
      parent_doc_id:   z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const doc = await getDocOrThrow(id, ctx.org.id);
      await assertDocAccess(ctx, doc, "edit");

      if (doc.is_locked && doc.locked_by !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Document is locked" });
      }

      // Snapshot a version before overwriting content
      if (data.content) {
        const lastVersion = await db.docVersion.findFirst({
          where: { document_id: id }, orderBy: { version_number: "desc" },
        });
        const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

        // Compute word count and reading time
        const text = extractText(data.content);
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        data.word_count = wordCount;
        data.reading_time_minutes = Math.ceil(wordCount / 200);
        data.content_text = text;

        await db.docVersion.create({
          data: {
            document_id:    id,
            version_number: nextVersionNumber,
            title:          doc.title,
            content:        doc.content as Prisma.InputJsonValue,
            content_text:   doc.content_text,
            changed_by:     ctx.user.id,
          },
        });
      }

      const updated = await db.document.update({ where: { id }, data: { ...data, updated_by: ctx.user.id } });

      if (data.parent_doc_id !== undefined || data.space_id !== undefined) {
        await updateBreadcrumbPath(id);
      }
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), permanent: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocOrThrow(input.id, ctx.org.id);
      await assertDocAccess(ctx, doc, "manage");
      if (input.permanent) {
        return db.document.delete({ where: { id: input.id } });
      }
      return db.document.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string(), restore: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocOrThrow(input.id, ctx.org.id);
      await assertDocAccess(ctx, doc, "edit");
      return db.document.update({
        where: { id: input.id },
        data: { is_archived: !input.restore, archived_at: input.restore ? null : new Date() },
      });
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), new_parent_id: z.string().nullable(), new_space_id: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocOrThrow(input.id, ctx.org.id);
      await assertDocAccess(ctx, doc, "edit");
      const updated = await db.document.update({
        where: { id: input.id },
        data: { parent_doc_id: input.new_parent_id, space_id: input.new_space_id },
      });
      await updateBreadcrumbPath(input.id);
      return updated;
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await db.document.findUniqueOrThrow({ where: { id: input.id } });
      await assertDocAccess(ctx, doc, "view");
      const { id: _id, created_at: _ca, updated_at: _ua, share_token: _st, views_count: _vc, ...rest } = doc;
      return db.document.create({
        data: {
          ...rest,
          title:      `${doc.title} (Copy)`,
          org_id:     ctx.org.id,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
          published_at: null,
          share_expires_at: null,
          share_can_edit: false,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ space_id: z.string().optional(), include_archived: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      // Return flat list; client assembles tree
      return db.document.findMany({
        where: {
          org_id:      ctx.org.id,
          space_id:    input.space_id,
          deleted_at:  null,
          is_archived: input.include_archived ? undefined : false,
        },
        select: {
          id: true, parent_doc_id: true, space_id: true, title: true,
          icon: true, position: true, visibility: true, is_archived: true,
          breadcrumb_path: true, children: { select: { id: true } },
        },
        orderBy: { position: "asc" },
      });
    }),

  // ── Versions ─────────────────────────────────────────────────────────────────

  "versions.list": protectedProcedure
    .input(z.object({ document_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.docVersion.findMany({
        where: { document_id: input.document_id },
        orderBy: { version_number: "desc" },
        include: { author: { select: { id: true, name: true, avatar_url: true } } },
      });
    }),

  "versions.restore": protectedProcedure
    .input(z.object({ document_id: z.string(), version_number: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const version = await db.docVersion.findUniqueOrThrow({
        where: { document_id_version_number: { document_id: input.document_id, version_number: input.version_number } },
      });
      return db.document.update({
        where: { id: input.document_id },
        data: { content: version.content as Prisma.InputJsonValue, title: version.title, updated_by: ctx.user.id },
      });
    }),

  "versions.name": protectedProcedure
    .input(z.object({ document_id: z.string(), version_number: z.number().int(), name: z.string().max(100) }))
    .mutation(async ({ ctx, input }) => {
      return db.docVersion.update({
        where: { document_id_version_number: { document_id: input.document_id, version_number: input.version_number } },
        data: { is_named: true, version_name: input.name },
      });
    }),

  // ── Comments ─────────────────────────────────────────────────────────────────

  "comments.list": protectedProcedure
    .input(z.object({ document_id: z.string(), show_resolved: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      return db.docComment.findMany({
        where: { document_id: input.document_id, deleted_at: null, parent_comment_id: null,
                 ...(!input.show_resolved && { is_resolved: false }) },
        include: {
          replies: { where: { deleted_at: null }, include: { author: { select: { id: true, name: true, avatar_url: true } } } },
          author: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: { created_at: "asc" },
      });
    }),

  "comments.create": protectedProcedure
    .input(z.object({
      document_id:       z.string(),
      parent_comment_id: z.string().optional(),
      block_id:          z.string().optional(),
      selected_text:     z.string().max(500).optional(),
      content:           z.string().min(1),
      content_html:      z.string().optional(),
      mentions:          z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.docComment.create({ data: { ...input, created_by: ctx.user.id } });
    }),

  "comments.resolve": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.docComment.update({
        where: { id: input.id },
        data: { is_resolved: true, resolved_by: ctx.user.id, resolved_at: new Date() },
      });
    }),

  "comments.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.docComment.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
    }),

  // ── Search ────────────────────────────────────────────────────────────────────

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1), space_id: z.string().optional(), limit: z.number().int().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const tsQuery = input.query.split(/\s+/).map(w => `${w}:*`).join(" & ");
      return db.$queryRaw<Array<{ id: string; title: string; breadcrumb_path: string; rank: number }>>`
        SELECT id, title, breadcrumb_path,
               ts_rank(content_tsvector, to_tsquery('english', ${tsQuery})) AS rank
        FROM documents
        WHERE org_id = ${ctx.org.id}
          AND deleted_at IS NULL
          AND is_archived = false
          AND content_tsvector @@ to_tsquery('english', ${tsQuery})
          ${input.space_id ? Prisma.sql`AND space_id = ${input.space_id}` : Prisma.empty}
        ORDER BY rank DESC
        LIMIT ${input.limit}
      `;
    }),

  // ── Favorites ─────────────────────────────────────────────────────────────────

  "favorites.add": protectedProcedure
    .input(z.object({ document_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.docFavorite.upsert({
        where: { user_id_document_id: { user_id: ctx.user.id, document_id: input.document_id } },
        create: { user_id: ctx.user.id, document_id: input.document_id },
        update: {},
      });
    }),

  "favorites.remove": protectedProcedure
    .input(z.object({ document_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.docFavorite.delete({
        where: { user_id_document_id: { user_id: ctx.user.id, document_id: input.document_id } },
      });
    }),

  "favorites.list": protectedProcedure.query(async ({ ctx }) => {
    return db.docFavorite.findMany({
      where: { user_id: ctx.user.id },
      include: { document: { select: { id: true, title: true, icon: true, space_id: true } } },
      orderBy: { created_at: "desc" },
    });
  }),

  // ── Share ─────────────────────────────────────────────────────────────────────

  "share.create": protectedProcedure
    .input(z.object({ document_id: z.string(), expires_in_days: z.number().int().optional(), can_edit: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const token = generateSecureToken(64);
      const expiresAt = input.expires_in_days
        ? new Date(Date.now() + input.expires_in_days * 86_400_000)
        : null;
      return db.document.update({
        where: { id: input.document_id },
        data: { share_token: token, share_expires_at: expiresAt, share_can_edit: input.can_edit },
      });
    }),

  "share.revoke": protectedProcedure
    .input(z.object({ document_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.document.update({
        where: { id: input.document_id },
        data: { share_token: null, share_expires_at: null },
      });
    }),

  "share.get": publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const doc = await db.document.findFirst({
        where: { share_token: input.token, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      if (doc.share_expires_at && doc.share_expires_at < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Share link has expired" });
      }
      return doc;
    }),

  // ── Permissions ───────────────────────────────────────────────────────────────

  "permissions.set": protectedProcedure
    .input(z.object({
      document_id:      z.string(),
      subject_type:     z.enum(["user","team","public"]),
      subject_id:       z.string().optional(),
      permission_level: z.enum(["view","comment","edit","manage"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.docPermission.upsert({
        where: { document_id_subject_type_subject_id: {
          document_id: input.document_id, subject_type: input.subject_type, subject_id: input.subject_id ?? "",
        }},
        create: { ...input, subject_id: input.subject_id ?? "", granted_by: ctx.user.id },
        update: { permission_level: input.permission_level },
      });
    }),

  "permissions.remove": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.docPermission.delete({ where: { id: input.id } });
    }),

  // ── Templates ─────────────────────────────────────────────────────────────────

  "templates.list": protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return db.document.findMany({
        where: { org_id: ctx.org.id, is_template: true, deleted_at: null,
                 ...(input.category && { template_category: input.category }) },
        select: { id: true, title: true, icon: true, template_category: true, cover_image_url: true },
        orderBy: { title: "asc" },
      });
    }),

  "templates.use": protectedProcedure
    .input(z.object({ template_id: z.string(), space_id: z.string().optional(), parent_doc_id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const tmpl = await db.document.findUniqueOrThrow({ where: { id: input.template_id } });
      return db.document.create({
        data: {
          org_id:        ctx.org.id,
          space_id:      input.space_id,
          parent_doc_id: input.parent_doc_id,
          title:         tmpl.title,
          icon:          tmpl.icon,
          content:       tmpl.content as Prisma.InputJsonValue,
          content_text:  tmpl.content_text,
          word_count:    tmpl.word_count,
          created_by:    ctx.user.id,
          updated_by:    ctx.user.id,
        },
      });
    }),

  // ── Export ────────────────────────────────────────────────────────────────────

  "export.pdf": protectedProcedure
    .input(z.object({ document_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Queues a BullMQ job; returns job ID for polling
      const job = await exportQueue.add("pdf-export", { document_id: input.document_id, user_id: ctx.user.id });
      return { job_id: job.id };
    }),

  "export.markdown": protectedProcedure
    .input(z.object({ document_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await getDocOrThrow(input.document_id, ctx.org.id);
      const markdown = tiptapJsonToMarkdown(doc.content);
      return { filename: `${doc.title}.md`, content: markdown };
    }),
});
```

---

## 5. Real-time Collaboration (Yjs + Tiptap)

### 5.1 WebSocket route: `apps/web/src/app/api/collab/[docId]/route.ts`

```typescript
import { setupWSConnection } from "y-websocket/bin/utils";
import * as http from "http";

// Next.js 15 route handler for raw WebSocket upgrade
export function GET(req: Request, { params }: { params: { docId: string } }) {
  const { docId } = params;
  // Validate user has access to docId via JWT in query param
  const upgradeHeader = req.headers.get("upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  // Delegate to y-websocket handler; persistence via y-leveldb or Redis
  // setupWSConnection handles awareness (cursor/presence) automatically
  // The docId becomes the Yjs room name
  return new Response(null, {
    status: 101,
    headers: { "upgrade": "websocket", "connection": "upgrade" },
  });
}
```

### 5.2 Client collaboration: `apps/web/src/lib/collaboration.ts`

```typescript
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { TiptapCollabProvider } from "@hocuspocus/provider";

export function createCollabProvider(docId: string, token: string) {
  const ydoc = new Y.Doc();

  const provider = new WebsocketProvider(
    process.env.NEXT_PUBLIC_COLLAB_WS_URL!,
    docId,
    ydoc,
    { params: { token } }
  );

  // Awareness: broadcast cursor position and user info
  provider.awareness.setLocalStateField("user", {
    name: "Current User",
    color: getRandomColor(),
  });

  return { ydoc, provider };
}

function getRandomColor(): string {
  const colors = ["#f87171","#fb923c","#a78bfa","#34d399","#60a5fa"];
  return colors[Math.floor(Math.random() * colors.length)];
}
```

### 5.3 BlockEditor component: `apps/web/src/components/documents/editor/BlockEditor.tsx`

```typescript
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { createCollabProvider } from "@/lib/collaboration";

export function BlockEditor({ docId, token }: { docId: string; token: string }) {
  const { ydoc, provider } = createCollabProvider(docId, token);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // Yjs handles undo/redo
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: "You", color: "#6366f1" },
      }),
      // ... custom extensions
    ],
  });

  return <EditorContent editor={editor} className="prose max-w-none" />;
}
```

---

## 6. Business Logic

### 6.1 Document tree recursive query (CTE)

```typescript
// Get full subtree rooted at a given document
export async function getDocumentSubtree(rootId: string, orgId: string) {
  return db.$queryRaw<Document[]>`
    WITH RECURSIVE doc_tree AS (
      SELECT * FROM documents WHERE id = ${rootId} AND org_id = ${orgId} AND deleted_at IS NULL
      UNION ALL
      SELECT d.* FROM documents d
      INNER JOIN doc_tree dt ON d.parent_doc_id = dt.id
      WHERE d.deleted_at IS NULL
    )
    SELECT * FROM doc_tree ORDER BY position ASC
  `;
}
```

### 6.2 Breadcrumb path caching

```typescript
export async function updateBreadcrumbPath(docId: string): Promise<void> {
  const ancestors: string[] = [];
  let currentId: string | null = docId;

  while (currentId) {
    const doc = await db.document.findUnique({ where: { id: currentId }, select: { title: true, parent_doc_id: true, space: { select: { name: true } } } });
    if (!doc) break;
    ancestors.unshift(doc.title);
    if (!doc.parent_doc_id && doc.space) ancestors.unshift(doc.space.name);
    currentId = doc.parent_doc_id;
  }

  await db.document.update({
    where: { id: docId },
    data: { breadcrumb_path: ancestors.join(" / ") },
  });
}
```

### 6.3 Version diff (JSON diff)

```typescript
import * as Diff from "diff-match-patch";

export function diffDocumentVersions(oldContent: object, newContent: object): string {
  const dmp = new Diff.diff_match_patch();
  const oldText = JSON.stringify(oldContent, null, 2);
  const newText = JSON.stringify(newContent, null, 2);
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  return dmp.diff_prettyHtml(diffs);
}
```

### 6.4 PDF export (BullMQ worker)

```typescript
// apps/web/src/workers/export.worker.ts
import puppeteer from "puppeteer";
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { s3 } from "@/lib/minio";

new Worker("exports", async (job) => {
  if (job.name === "pdf-export") {
    const { document_id } = job.data;
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Render the internal document view
    await page.goto(`${process.env.INTERNAL_URL}/documents/${document_id}/print`, {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    // Upload to MinIO
    const key = `exports/${document_id}/${Date.now()}.pdf`;
    await s3.putObject("zenflow", key, pdfBuffer, pdfBuffer.length, { "Content-Type": "application/pdf" });

    const url = await s3.presignedGetObject("zenflow", key, 3600);
    return { url };
  }
}, { connection: redis });
```

---

## 7. Files Structure

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── documents/
│   │       ├── page.tsx                          # Space + doc tree listing
│   │       ├── [id]/
│   │       │   ├── page.tsx                      # Main editor page
│   │       │   └── history/
│   │       │       └── page.tsx                  # Version history + diff viewer
│   │       └── shared/
│   │           └── [token]/page.tsx              # Public share view
│   └── api/
│       └── collab/
│           └── [docId]/route.ts                  # Yjs WebSocket endpoint
├── components/
│   └── documents/
│       ├── editor/
│       │   ├── BlockEditor.tsx                   # Main Tiptap editor
│       │   ├── extensions/
│       │   │   ├── callout.ts
│       │   │   ├── toggle.ts
│       │   │   ├── mermaid.ts
│       │   │   ├── math-block.ts
│       │   │   ├── youtube.ts
│       │   │   └── mention.ts
│       │   ├── toolbar/
│       │   │   ├── FloatingToolbar.tsx           # Text selection toolbar
│       │   │   ├── BubbleMenu.tsx                # Inline format menu
│       │   │   └── SlashCommandMenu.tsx          # / command palette
│       │   └── blocks/
│       │       ├── CalloutBlock.tsx
│       │       ├── ToggleBlock.tsx
│       │       ├── MermaidBlock.tsx
│       │       └── MathBlock.tsx
│       ├── sidebar/
│       │   ├── DocTree.tsx                       # Recursive tree view
│       │   ├── SpaceList.tsx
│       │   ├── FavoritesList.tsx
│       │   └── DocTreeItem.tsx                   # Drag-and-drop item
│       ├── comments/
│       │   ├── CommentSidebar.tsx
│       │   ├── CommentThread.tsx
│       │   └── CommentInput.tsx
│       ├── history/
│       │   ├── VersionList.tsx
│       │   └── VersionDiffViewer.tsx
│       └── share/
│           └── ShareDialog.tsx
└── server/
    └── api/
        └── routers/
            └── documents.ts
```

---

## 8. npm Packages

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-collaboration": "^2.x",
  "@tiptap/extension-collaboration-cursor": "^2.x",
  "@tiptap/extension-task-list": "^2.x",
  "@tiptap/extension-task-item": "^2.x",
  "@tiptap/extension-table": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "@tiptap/extension-mention": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-character-count": "^2.x",
  "yjs": "^13.x",
  "y-prosemirror": "^1.x",
  "y-websocket": "^1.x",
  "@hocuspocus/provider": "^2.x",
  "puppeteer": "^21.x",
  "diff-match-patch": "^1.x",
  "katex": "^0.x",
  "mermaid": "^10.x",
  "lowlight": "^3.x"
}
```

---

## 9. Environment Variables

```bash
NEXT_PUBLIC_COLLAB_WS_URL=ws://localhost:1234
COLLAB_SERVER_PORT=1234
INTERNAL_URL=http://localhost:3000
```
