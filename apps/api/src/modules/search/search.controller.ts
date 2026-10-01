import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { FollowListResponse } from '@instagram-clone/validation';

import { type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalCurrentUser } from '../auth/optional-current-user.decorator';
import { SearchUsersQueryDto } from './search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('users')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: 'Search for users by username/full name (pg_trgm similarity).',
  })
  async searchUsers(
    @OptionalCurrentUser() viewer: AuthenticatedUser | undefined,
    @Query() query: SearchUsersQueryDto,
  ): Promise<FollowListResponse> {
    return this.searchService.searchUsers(query, viewer?.id);
  }
}
