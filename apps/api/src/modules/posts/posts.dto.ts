import { createZodDto } from 'nestjs-zod';

import {
  createPostInputSchema,
  paginationQuerySchema,
} from '@instagram-clone/validation';

export class CreatePostDto extends createZodDto(createPostInputSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
