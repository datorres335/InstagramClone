import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService, type HealthCheckResult } from './health.service';

/**
 * Exempted from the global rate limit (Milestone 20 hardening pass) — a
 * liveness/readiness check is exactly the kind of endpoint a load balancer
 * or orchestrator (k8s probes, etc.) polls frequently in a real deployment,
 * and throttling it would turn normal, expected polling into false
 * "unhealthy" signals under real traffic. Concretely demonstrated by this
 * same milestone's own `apps/api-e2e/src/security/security.spec.ts`: an
 * early draft of its rate-limiting test hammered this endpoint to prove the
 * throttle works and intermittently 429'd `health.spec.ts`'s own unrelated
 * single health check running concurrently — the exact false-negative
 * failure mode a real health check must never be subject to.
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle()
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
