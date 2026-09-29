import { createZodDto } from 'nestjs-zod';

import { presignMediaInputSchema } from '@instagram-clone/validation';

export class PresignMediaDto extends createZodDto(presignMediaInputSchema) {}
