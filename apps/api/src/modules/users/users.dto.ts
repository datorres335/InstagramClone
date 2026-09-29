import { createZodDto } from 'nestjs-zod';

import {
  paginationQuerySchema,
  updateAvatarInputSchema,
  updateProfileInputSchema,
} from '@instagram-clone/validation';

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileInputSchema) {}
export class UpdateAvatarDto extends createZodDto(updateAvatarInputSchema) {}
