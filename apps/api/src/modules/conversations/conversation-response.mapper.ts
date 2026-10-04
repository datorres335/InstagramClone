import type { Media, Message, User } from '@instagram-clone/prisma-client';
import type {
  ConversationResponse,
  MessageResponse,
} from '@instagram-clone/validation';

import type { MediaService } from '../media/media.service';

type UserWithAvatar = User & { avatarMedia: Media | null };
type MessageWithSender = Message & { sender: UserWithAvatar };

export function toMessageResponse(
  message: MessageWithSender,
  mediaService: MediaService,
): MessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: {
      id: message.sender.id,
      username: message.sender.username,
      fullName: message.sender.fullName,
      avatarUrl: mediaService.resolveAvatarUrl(message.sender.avatarMedia),
    },
    body: message.body,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationResponse(
  conversation: {
    id: string;
    createdAt: Date;
    lastMessageAt: Date;
    participants: { user: UserWithAvatar }[];
  },
  viewerId: string,
  lastMessage: MessageWithSender | null,
  unreadCount: number,
  mediaService: MediaService,
): ConversationResponse {
  return {
    id: conversation.id,
    otherParticipants: conversation.participants
      .filter((participant) => participant.user.id !== viewerId)
      .map((participant) => ({
        id: participant.user.id,
        username: participant.user.username,
        fullName: participant.user.fullName,
        avatarUrl: mediaService.resolveAvatarUrl(participant.user.avatarMedia),
      })),
    lastMessage: lastMessage
      ? toMessageResponse(lastMessage, mediaService)
      : null,
    unreadCount,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
  };
}
