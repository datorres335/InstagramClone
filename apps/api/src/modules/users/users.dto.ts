import { createZodDto } from 'nestjs-zod';

import {
  changeEmailInputSchema,
  changePasswordInputSchema,
  deleteAccountInputSchema,
  paginationQuerySchema,
  updateAvatarInputSchema,
  updateProfileInputSchema,
} from '@instagram-clone/validation';

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileInputSchema) {}
export class UpdateAvatarDto extends createZodDto(updateAvatarInputSchema) {}
export class ChangePasswordDto extends createZodDto(
  changePasswordInputSchema,
) {}
export class ChangeEmailDto extends createZodDto(changeEmailInputSchema) {}
export class DeleteAccountDto extends createZodDto(deleteAccountInputSchema) {}
