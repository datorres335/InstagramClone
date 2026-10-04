'use client';

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
    <form onSubmit={handleSubmit}>
      <label htmlFor="new-message-username">New message to</label>
      <input
        id="new-message-username"
        type="text"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="username"
      />
      <button type="submit" disabled={pending || !username.trim()}>
        {pending ? 'Starting…' : 'Chat'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
