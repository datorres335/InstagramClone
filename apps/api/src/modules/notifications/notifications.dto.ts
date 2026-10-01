import { createZodDto } from 'nestjs-zod';

import {
  markReadInputSchema,
  paginationQuerySchema,
} from '@instagram-clone/validation';

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class MarkReadDto extends createZodDto(markReadInputSchema) {}
