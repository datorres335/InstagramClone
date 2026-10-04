import { createZodDto } from 'nestjs-zod';

import {
  createMessageInputSchema,
  paginationQuerySchema,
  startConversationInputSchema,
} from '@instagram-clone/validation';

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class StartConversationDto extends createZodDto(
  startConversationInputSchema,
) {}
export class CreateMessageDto extends createZodDto(createMessageInputSchema) {}
