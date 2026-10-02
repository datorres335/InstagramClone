import {
  changeEmailInputSchema,
  changePasswordInputSchema,
  deleteAccountInputSchema,
} from './account-settings';

describe('changePasswordInputSchema', () => {
  it('accepts a valid change-password body', () => {
    const result = changePasswordInputSchema.safeParse({
      currentPassword: 'old-password-1',
      newPassword: 'new-password-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty currentPassword', () => {
    const result = changePasswordInputSchema.safeParse({
      currentPassword: '',
      newPassword: 'new-password-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a newPassword shorter than 8 characters', () => {
    const result = changePasswordInputSchema.safeParse({
      currentPassword: 'old-password-1',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('changeEmailInputSchema', () => {
  it('accepts a valid change-email body', () => {
    const result = changeEmailInputSchema.safeParse({
      newEmail: 'new@example.com',
      currentPassword: 'old-password-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = changeEmailInputSchema.safeParse({
      newEmail: 'not-an-email',
      currentPassword: 'old-password-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty currentPassword', () => {
    const result = changeEmailInputSchema.safeParse({
      newEmail: 'new@example.com',
      currentPassword: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('deleteAccountInputSchema', () => {
  it('accepts a valid delete-account body', () => {
    const result = deleteAccountInputSchema.safeParse({
      currentPassword: 'old-password-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing currentPassword', () => {
    const result = deleteAccountInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
