import { createZodDto } from 'nestjs-zod';

import { searchUsersQuerySchema } from '@instagram-clone/validation';

export class SearchUsersQueryDto extends createZodDto(searchUsersQuerySchema) {}
