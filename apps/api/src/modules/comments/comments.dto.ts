import { createZodDto } from 'nestjs-zod';

import {
  createCommentInputSchema,
  paginationQuerySchema,
} from '@instagram-clone/validation';

export class CreateCommentDto extends createZodDto(createCommentInputSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
