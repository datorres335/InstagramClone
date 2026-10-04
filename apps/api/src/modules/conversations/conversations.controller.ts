import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  ConversationListResponse,
  ConversationResponse,
  MessageListResponse,
  MessageResponse,
} from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateMessageDto,
  PaginationQueryDto,
  StartConversationDto,
} from './conversations.dto';
import { ConversationsService } from './conversations.service';

/**
 * `/conversations*` — docs/API.md §17. Required auth on every route, the
 * same "no anonymous or other-viewer case exists" reasoning `GET
 * /notifications`/`GET /me/saved` already established: a conversation list
 * only ever means "my own," and a thread's membership check (in the
 * service) replaces the single-owner/follow-based authorization every
 * earlier domain module has used instead.
 */
@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Start (or return the existing) 1:1 conversation with a user.',
  })
  async startConversation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: StartConversationDto,
  ): Promise<ConversationResponse> {
    return this.conversationsService.startConversation(
      currentUser.id,
      body.username,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List your own conversations, newest activity first.',
  })
  async getConversations(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<ConversationListResponse> {
    return this.conversationsService.listConversations(currentUser.id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single conversation by id.' })
  async getConversation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConversationResponse> {
    return this.conversationsService.getConversation(currentUser.id, id);
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List a conversation’s messages, oldest first.' })
  async getMessages(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<MessageListResponse> {
    return this.conversationsService.getMessages(currentUser.id, id, query);
  }

  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send a message in a conversation.' })
  async sendMessage(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateMessageDto,
  ): Promise<MessageResponse> {
    return this.conversationsService.sendMessage(currentUser.id, id, body.body);
  }
}
