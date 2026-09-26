import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { ConfigModule } from '../config/config.module';
import { HealthModule } from '../health/health.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule],
  providers: [
    // Validates every @Body()/@Query()/@Param() against the Zod schema its
    // DTO was created from (createZodDto, from packages/validation) —
    // see docs/ARCHITECTURE.md §5.2. Not exercised by a real endpoint until
    // Milestone 5's auth DTOs exist; see prisma.service.spec.ts-adjacent
    // tests in this milestone for a direct proof the wiring works.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Turns every thrown exception (Zod validation failures included) into
    // the RFC 7807 Problem Details shape docs/API.md §1 specifies.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
