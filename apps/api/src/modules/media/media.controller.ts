import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  MediaResponse,
  PresignMediaResponse,
} from '@instagram-clone/validation';

import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PresignMediaDto } from './media.dto';
import { MediaService } from './media.service';

/** `/media/*` — docs/API.md §6. Every route requires auth: an upload always belongs to someone. */
@ApiTags('media')
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Request a presigned upload slot for a new image.' })
  async presign(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: PresignMediaDto,
  ): Promise<PresignMediaResponse> {
    return this.mediaService.presign(currentUser.id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a direct upload landed and queue variant processing.',
  })
  async complete(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MediaResponse> {
    return this.mediaService.complete(currentUser.id, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Poll processing status for an uploaded media.' })
  async getById(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MediaResponse> {
    return this.mediaService.getById(currentUser.id, id);
  }
}
