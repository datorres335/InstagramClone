import { type ArgumentsHost, NotFoundException } from '@nestjs/common';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';

import { HttpExceptionFilter } from './http-exception.filter';

function createMockHost(url = '/api/v1/whatever') {
  const json = jest.fn();
  const type = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnThis();
  const response = { status, type, json };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ originalUrl: url, url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('formats a ZodValidationException as validation-failed with field errors', async () => {
    class TestDto extends createZodDto(z.object({ name: z.string().min(1) })) {}
    const pipe = new ZodValidationPipe();

    let caught: unknown;
    try {
      await pipe.transform({ name: '' }, { type: 'body', metatype: TestDto });
    } catch (error) {
      caught = error;
    }

    const { host, response } = createMockHost('/api/v1/test');
    filter.catch(caught, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://api.instagram-clone.dev/errors/validation-failed',
        title: 'Validation failed',
        status: 400,
        instance: '/api/v1/test',
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'name' }),
        ]),
      }),
    );
  });

  it('formats a NotFoundException with the matching status slug', () => {
    const { host, response } = createMockHost('/api/v1/missing');
    filter.catch(new NotFoundException(), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://api.instagram-clone.dev/errors/not-found',
        title: 'NotFound',
        status: 404,
        instance: '/api/v1/missing',
      }),
    );
  });

  it('never leaks details for an unrecognized error', () => {
    const { host, response } = createMockHost('/api/v1/boom');
    filter.catch(new Error('sensitive stack trace details'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('sensitive stack trace details');
    expect(body).toEqual(
      expect.objectContaining({
        type: 'https://api.instagram-clone.dev/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        instance: '/api/v1/boom',
      }),
    );
  });
});
