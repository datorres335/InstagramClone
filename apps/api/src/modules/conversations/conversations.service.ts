import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Conversation, User } from '@instagram-clone/prisma-client';
import type {
  ConversationListResponse,
  ConversationResponse,
  MessageListResponse,
  MessageResponse,
  PaginationQuery,
} from '@instagram-clone/validation';

import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import {
  toConversationResponse,
  toMessageResponse,
} from './conversation-response.mapper';

const CONVERSATION_INCLUDE = {
  participants: { include: { user: { include: { avatarMedia: true } } } },
} as const;

const MESSAGE_SENDER_INCLUDE = {
  sender: { include: { avatarMedia: true } },
} as const;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * `POST /conversations` (docs/API.md §17) — idempotent: starting a
   * conversation with someone you already have one with returns the
   * existing conversation, not a duplicate, mirroring `Follow`'s own
   * self-referential dedup precedent (Milestone 10). This milestone only
   * ever creates 1:1 conversations, so "the existing conversation with this
   * pair" means exactly 2 participants — found via a JS-level filter after
   * the DB-level `some`/`some` match (which alone would also match a future
   * group conversation containing both users); acceptable at MVP scale
   * since a user's own conversation list is never large enough for this to
   * matter.
   */
  async startConversation(
    callerId: string,
    username: string,
  ): Promise<ConversationResponse> {
    const target = await this.findActiveUserByUsername(username);
    if (target.id === callerId) {
      throw new ConflictException(
        'You cannot start a conversation with yourself.',
      );
    }

    const candidates = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId: callerId } },
        AND: { participants: { some: { userId: target.id } } },
      },
      include: CONVERSATION_INCLUDE,
    });
    const existing = candidates.find((c) => c.participants.length === 2);

    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId: callerId }, { userId: target.id }],
          },
        },
        include: CONVERSATION_INCLUDE,
      }));

    return toConversationResponse(
      conversation,
      callerId,
      null,
      0,
      this.mediaService,
    );
  }

  /**
   * `GET /conversations/:id` (docs/API.md §17) — a single-resource `GET`
   * added beyond `docs/IMPLEMENTATION_PLAN.md` M21's original endpoint list:
   * the thread view needs *some* way to render "who am I talking to" even
   * before the conversation has any messages (`GET .../messages` alone
   * can't supply that for an empty thread), the same "single resource,
   * unwrapped" convention every other `GET /:id` in this codebase follows.
   */
  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponse> {
    await this.assertParticipant(conversationId, userId);

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        ...CONVERSATION_INCLUDE,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: MESSAGE_SENDER_INCLUDE,
        },
      },
    });
    const unreadCount = await this.prisma.message.count({
      where: { conversationId, senderId: { not: userId }, readAt: null },
    });

    return toConversationResponse(
      conversation,
      userId,
      conversation.messages[0] ?? null,
      unreadCount,
      this.mediaService,
    );
  }

  /** `GET /conversations` (docs/API.md §17) — newest-activity-first, keyset-paginated on `(lastMessageAt, id)`. */
  async listConversations(
    userId: string,
    query: PaginationQuery,
  ): Promise<ConversationListResponse> {
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
        ...(decoded && {
          OR: [
            { lastMessageAt: { lt: decoded.createdAt } },
            { lastMessageAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        ...CONVERSATION_INCLUDE,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: MESSAGE_SENDER_INCLUDE,
        },
      },
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.lastMessageAt, id: lastRow.id })
        : null;

    // One batched query for the whole page's unread counts, not one per
    // conversation — the same "batch per page" shape
    // `LikesService.getLikeStateForPosts` established (Milestone 13).
    const unreadCounts =
      page.length > 0
        ? await this.prisma.message.groupBy({
            by: ['conversationId'],
            where: {
              conversationId: { in: page.map((row) => row.id) },
              senderId: { not: userId },
              readAt: null,
            },
            _count: { _all: true },
          })
        : [];
    const unreadByConversation = new Map(
      unreadCounts.map((row) => [row.conversationId, row._count._all]),
    );

    const data: ConversationResponse[] = page.map((row) =>
      toConversationResponse(
        row,
        userId,
        row.messages[0] ?? null,
        unreadByConversation.get(row.id) ?? 0,
        this.mediaService,
      ),
    );

    return { data, meta: { nextCursor } };
  }

  /**
   * `GET /conversations/:id/messages` (docs/API.md §17) — newest-first at
   * the query/cursor level (the `lt`-keyset convention `GET /feed`/
   * `GET /notifications` use), **not** `GET /posts/:postId/comments`'s
   * oldest-first convention: a chat thread needs to open on its most
   * recent activity, the same reason every other newest-first list in this
   * codebase opens on its most recent rows; a comment thread is read top-
   * to-bottom on a page that loads once, which is a genuinely different
   * access pattern. `data` is returned in **chronological (ascending)**
   * order within the page, though — the natural order to render a chat
   * thread in — so the newest-first-ness only shows up in which messages
   * get selected and in `nextCursor` pointing further into the past, not
   * in the array order callers receive. Viewing a page marks *every*
   * currently-unread message in this conversation (not only the ones on
   * this page) as read, the same "mark read as a side effect of viewing"
   * convention `GET /notifications` already established (Milestone 16) —
   * fired after the page is read, so the returned `readAt` values still
   * reflect each message's real pre-view state.
   */
  async getMessages(
    userId: string,
    conversationId: string,
    query: PaginationQuery,
  ): Promise<MessageListResponse> {
    await this.assertParticipant(conversationId, userId);
    const decoded = this.decodeCursorOrThrow(query.cursor);

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: MESSAGE_SENDER_INCLUDE,
    });

    const page = rows.slice(0, query.limit);
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    const data: MessageResponse[] = page
      .slice()
      .reverse()
      .map((row) => toMessageResponse(row, this.mediaService));

    return { data, meta: { nextCursor } };
  }

  /** `POST /conversations/:id/messages` (docs/API.md §17). */
  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
  ): Promise<MessageResponse> {
    await this.assertParticipant(conversationId, userId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, body },
        include: MESSAGE_SENDER_INCLUDE,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return toMessageResponse(message, this.mediaService);
  }

  /**
   * The first "is the viewer a participant" (membership, not ownership or
   * following) authorization check in this codebase — `404` if the
   * conversation doesn't exist at all, `403` if it exists but the caller
   * isn't in it, so a caller can't distinguish "doesn't exist" from "not
   * yours" for someone else's conversation either way beyond that.
   */
  private async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { userId: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not a participant in this conversation.',
      );
    }
    return conversation;
  }

  private decodeCursorOrThrow(cursor: string | undefined) {
    if (!cursor) return null;
    const decoded = decodeCursor(cursor);
    if (!decoded) throw new BadRequestException('Invalid cursor.');
    return decoded;
  }

  private async findActiveUserByUsername(username: string): Promise<User> {
    // Same shape as every other domain service's private helper of the
    // same name (`FollowsService`, `UsersService`, ...) — kept as its own
    // small copy rather than a shared abstraction, the established
    // trade-off in this codebase (see `FollowsService`'s own doc comment).
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }
}
