import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HealthService, type HealthCheckResult } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness check (process + database)' })
  @ApiResponse({
    status: 200,
    description: 'The API and its database are reachable.',
  })
  @ApiResponse({ status: 503, description: 'The database is unreachable.' })
  check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
