import { createZodDto } from 'nestjs-zod';

import {
  paginationQuerySchema,
  updateProfileInputSchema,
} from '@instagram-clone/validation';

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileInputSchema) {}
