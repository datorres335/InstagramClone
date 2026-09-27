import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Thin wrapper around `argon2` (argon2id — docs/ARCHITECTURE.md §7), kept as
 * its own injectable so it's trivially mockable in tests and there's exactly
 * one place in the codebase that knows which hashing algorithm is in use.
 */
@Injectable()
export class PasswordService {
  hash(plainTextPassword: string): Promise<string> {
    return argon2.hash(plainTextPassword);
  }

  verify(hash: string, plainTextPassword: string): Promise<boolean> {
    return argon2.verify(hash, plainTextPassword);
  }
}
