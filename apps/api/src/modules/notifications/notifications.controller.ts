import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  NotificationListResponse,
  UnreadCountResponse,
} from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MarkReadDto, PaginationQueryDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

/** `/notifications*` — docs/API.md §12. Required auth on every route; there's no anonymous or other-viewer case for "my own notifications." */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List your own notifications, newest first.' })
  async getNotifications(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.getNotifications(currentUser.id, query);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get your unread notification count.' })
  async getUnreadCount(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UnreadCountResponse> {
    return this.notificationsService.getUnreadCount(currentUser.id);
  }

  @Post('mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Mark notifications as read (omit notificationIds to mark all as read).',
  })
  async markRead(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: MarkReadDto,
  ): Promise<void> {
    await this.notificationsService.markRead(
      currentUser.id,
      body.notificationIds,
    );
  }
}
