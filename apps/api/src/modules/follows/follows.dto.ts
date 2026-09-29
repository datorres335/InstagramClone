import { createZodDto } from 'nestjs-zod';

import { paginationQuerySchema } from '@instagram-clone/validation';

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
