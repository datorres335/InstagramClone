'use client';

import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { startConversationAction } from './actions';

/** The "new message" affordance on the inbox page — starts (or jumps to the existing) 1:1 conversation by username. */
export function StartConversationForm() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const conversation = await startConversationAction(trimmed);
        router.push(`/messages/${conversation.id}`);
      } catch {
        setError(
          'Could not start a conversation with that user. Please check the username and try again.',
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <TextField
          id="new-message-username"
          label="New message to"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          size="small"
          fullWidth
          slotProps={{ htmlInput: { autoCapitalize: 'none' } }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={pending || !username.trim()}
          className="min-h-10 shrink-0"
        >
          {pending ? 'Starting…' : 'Chat'}
        </Button>
      </div>
      {error && (
        <FormHelperText error role="alert">
          {error}
        </FormHelperText>
      )}
    </form>
  );
}
