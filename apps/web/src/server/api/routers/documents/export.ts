import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/** Converts a Tiptap JSON node to Markdown text (simple recursive implementation) */
function nodeToMarkdown(node: Record<string, unknown>): string {
  const type = node.type as string;
  const content = (node.content as Record<string, unknown>[] | undefined) ?? [];

  const childText = () => content.map((c) => nodeToMarkdown(c)).join('');

  switch (type) {
    case 'doc':
      return content.map((c) => nodeToMarkdown(c)).join('\n\n');
    case 'paragraph':
      return childText();
    case 'heading': {
      const level = (node.attrs as { level?: number } | undefined)?.level ?? 1;
      return `${'#'.repeat(level)} ${childText()}`;
    }
    case 'bulletList':
      return content.map((c) => `- ${nodeToMarkdown(c)}`).join('\n');
    case 'orderedList':
      return content.map((c, i) => `${i + 1}. ${nodeToMarkdown(c)}`).join('\n');
    case 'listItem':
      return childText();
    case 'taskList':
      return content.map((c) => nodeToMarkdown(c)).join('\n');
    case 'taskItem': {
      const checked = (node.attrs as { checked?: boolean } | undefined)?.checked ? 'x' : ' ';
      return `- [${checked}] ${childText()}`;
    }
    case 'blockquote':
      return childText()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'codeBlock': {
      const lang = (node.attrs as { language?: string } | undefined)?.language ?? '';
      return `\`\`\`${lang}\n${childText()}\n\`\`\``;
    }
    case 'image': {
      const attrs = (node.attrs as { src?: string; alt?: string } | undefined) ?? {};
      return `![${attrs.alt ?? ''}](${attrs.src ?? ''})`;
    }
    case 'horizontalRule':
      return '---';
    case 'hardBreak':
      return '\n';
    case 'text': {
      let text = (node.text as string) ?? '';
      const marks = (node.marks as Array<{ type: string; attrs?: Record<string, unknown> }>) ?? [];
      for (const mark of marks) {
        if (mark.type === 'bold') text = `**${text}**`;
        else if (mark.type === 'italic') text = `_${text}_`;
        else if (mark.type === 'code') text = `\`${text}\``;
        else if (mark.type === 'strike') text = `~~${text}~~`;
        else if (mark.type === 'link') {
          const href = (mark.attrs as { href?: string } | undefined)?.href ?? '#';
          text = `[${text}](${href})`;
        }
      }
      return text;
    }
    default:
      return childText();
  }
}

export const exportRouter = createTRPCRouter({
  markdown: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      const content = (doc.content as Record<string, unknown> | null) ?? { type: 'doc', content: [] };
      const markdown = `# ${doc.title}\n\n${nodeToMarkdown(content)}`;

      return {
        filename: `${doc.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.md`,
        content: markdown,
        mimeType: 'text/markdown',
      };
    }),

  pdf: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true, title: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      // Return a job ID placeholder — BullMQ/Puppeteer worker would pick this up in production
      const jobId = `pdf-${doc.id}-${Date.now()}`;
      return {
        jobId,
        status: 'queued',
        message: 'PDF export queued. Download link will be available shortly.',
      };
    }),
});
