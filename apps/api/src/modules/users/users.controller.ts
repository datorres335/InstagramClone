import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  PublicProfileResponse,
  UserPostsResponse,
} from '@instagram-clone/validation';

import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalCurrentUser } from '../auth/optional-current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PaginationQueryDto } from './users.dto';
import { UsersService } from './users.service';

/** `/users/*` — docs/API.md §4. Public profile data; auth is optional and only changes what's computed. */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get a user's public profile." })
  async getProfile(
    @Param('username') username: string,
    @OptionalCurrentUser() viewer: AuthenticatedUser | undefined,
  ): Promise<PublicProfileResponse> {
    return this.usersService.getPublicProfile(username, viewer?.id);
  }

  @Get(':username/posts')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get a user's posts (paginated profile grid)." })
  async getPosts(
    @Param('username') username: string,
    @Query() query: PaginationQueryDto,
  ): Promise<UserPostsResponse> {
    return this.usersService.getUserPosts(username, query);
  }
}
