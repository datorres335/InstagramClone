import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { encodeCursor } from '../../common/pagination/cursor';
import { ConversationsService } from './conversations.service';

const fakeTarget = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  deletedAt: null,
};

const fakeSelf = {
  id: 'user-1',
  username: 'alice',
  fullName: 'Alice Anderson',
  avatarMedia: null,
};

const fakeOther = {
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarMedia: null,
};

function createDeps() {
  const prisma = {
    user: { findFirst: jest.fn() },
    conversation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversationParticipant: { findUnique: jest.fn() },
    message: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  };
  const mediaService = {
    resolveAvatarUrl: jest.fn().mockReturnValue(null),
  };
  const service = new ConversationsService(
    prisma as never,
    mediaService as never,
  );
  return { service, prisma, mediaService };
}

describe('ConversationsService', () => {
  describe('startConversation', () => {
    it('creates a new conversation when none exists for this pair', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
        participants: [{ user: fakeSelf }, { user: fakeOther }],
      });

      const result = await service.startConversation('user-1', 'bob');

      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            participants: {
              create: [{ userId: 'user-1' }, { userId: 'user-2' }],
            },
          },
        }),
      );
      expect(result.id).toBe('conv-1');
      expect(result.otherParticipants).toEqual([
        {
          id: 'user-2',
          username: 'bob',
          fullName: 'Bob Builder',
          avatarUrl: null,
        },
      ]);
    });

    it('returns the existing 1:1 conversation instead of creating a duplicate', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeTarget);
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-existing',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
          participants: [{ user: fakeSelf }, { user: fakeOther }],
        },
      ]);

      const result = await service.startConversation('user-1', 'bob');

      expect(prisma.conversation.create).not.toHaveBeenCalled();
      expect(result.id).toBe('conv-existing');
    });

    it('rejects starting a conversation with yourself', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue({ ...fakeTarget, id: 'user-1' });

      await expect(
        service.startConversation('user-1', 'alice'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a username that does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.startConversation('user-1', 'nobody'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getConversation', () => {
    it('throws ForbiddenException when the caller is not a participant', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversation('user-1', 'conv-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the conversation with its last message and unread count', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      prisma.conversation.findUniqueOrThrow.mockResolvedValue({
        id: 'conv-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
        participants: [{ user: fakeSelf }, { user: fakeOther }],
        messages: [],
      });
      prisma.message.count.mockResolvedValue(2);

      const result = await service.getConversation('user-1', 'conv-1');

      expect(result.id).toBe('conv-1');
      expect(result.unreadCount).toBe(2);
      expect(result.lastMessage).toBeNull();
    });
  });

  describe('getMessages', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessages('user-1', 'conv-1', { limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not a participant', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessages('user-1', 'conv-1', { limit: 20 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });

    it('lists the newest messages, rendered chronologically, and marks unread ones as read', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          body: 'second',
          readAt: null,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          sender: fakeOther,
        },
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          body: 'first',
          readAt: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          sender: fakeOther,
        },
      ]);

      const result = await service.getMessages('user-1', 'conv-1', {
        limit: 20,
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 'conv-1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-1',
          senderId: { not: 'user-1' },
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
      // Query selects newest-first, but the returned page is chronological.
      expect(result.data.map((m) => m.body)).toEqual(['first', 'second']);
    });

    it('applies the decoded cursor as a lt keyset filter', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      prisma.message.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'msg-9',
      });

      await service.getMessages('user-1', 'conv-1', { cursor, limit: 20 });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId: 'conv-1',
            OR: [
              { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                id: { lt: 'msg-9' },
              },
            ],
          },
        }),
      );
    });
  });

  describe('sendMessage', () => {
    it('throws ForbiddenException when the caller is not a participant', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('user-1', 'conv-1', 'hi'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the message and bumps the conversation lastMessageAt', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      prisma.message.create.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        body: 'hi',
        readAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        sender: fakeSelf,
      });
      prisma.conversation.update.mockResolvedValue({});

      const result = await service.sendMessage('user-1', 'conv-1', 'hi');

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { conversationId: 'conv-1', senderId: 'user-1', body: 'hi' },
        }),
      );
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: { lastMessageAt: expect.any(Date) },
        }),
      );
      expect(result.body).toBe('hi');
    });
  });

  describe('listConversations', () => {
    it('returns conversations with last message and unread count', async () => {
      const { service, prisma } = createDeps();
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          lastMessageAt: new Date('2026-01-02T00:00:00.000Z'),
          participants: [{ user: fakeSelf }, { user: fakeOther }],
          messages: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              body: 'hi',
              readAt: null,
              createdAt: new Date('2026-01-02T00:00:00.000Z'),
              sender: fakeOther,
            },
          ],
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([
        { conversationId: 'conv-1', _count: { _all: 3 } },
      ]);

      const result = await service.listConversations('user-1', { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].unreadCount).toBe(3);
      expect(result.data[0].lastMessage?.body).toBe('hi');
      expect(result.data[0].otherParticipants).toEqual([
        {
          id: 'user-2',
          username: 'bob',
          fullName: 'Bob Builder',
          avatarUrl: null,
        },
      ]);
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      const row = (n: number) => ({
        id: `conv-${n}`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
        participants: [{ user: fakeSelf }, { user: fakeOther }],
        messages: [],
      });
      prisma.conversation.findMany.mockResolvedValue([row(1), row(2), row(3)]);

      const result = await service.listConversations('user-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.nextCursor).not.toBeNull();
    });
  });
});
