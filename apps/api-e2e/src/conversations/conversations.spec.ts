import axios from 'axios';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real conversation/message pipeline end to end against the
 * live Dockerized Postgres — real accounts, not mocked, matching every
 * milestone's testing discipline since Milestone 5.
 *
 * 3 accounts registered for the whole file (shared via `beforeAll`): alice
 * and bob (the 1:1 pair every idempotency/pagination case uses), carol (the
 * non-participant case — not in any conversation with alice/bob, must be
 * rejected). Register throttle has real headroom (60/min/IP since Milestone
 * 18) — only 3 registrations, well within budget.
 */

async function registerUser() {
  const credentials = randomRegisterInput();
  const res = await axios.post('/api/v1/auth/register', credentials);
  return {
    credentials,
    accessToken: res.data.accessToken as string,
    user: res.data.user,
  };
}

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let carol: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([
    registerUser(),
    registerUser(),
    registerUser(),
  ]);
});

describe('conversations: POST /conversations', () => {
  it('starts a new conversation and returns the other participant', async () => {
    const res = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    expect(res.status).toBe(201);
    expect(res.data.otherParticipants).toEqual([
      expect.objectContaining({ username: bob.credentials.username }),
    ]);
    expect(res.data.lastMessage).toBeNull();
  });

  it('is idempotent: starting it again returns the same conversation', async () => {
    const first = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );
    const second = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    expect(second.data.id).toBe(first.data.id);
  });

  it('is idempotent from the other participant’s side too', async () => {
    const fromAlice = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );
    const fromBob = await axios.post(
      '/api/v1/conversations',
      { username: alice.credentials.username },
      authHeader(bob.accessToken),
    );

    expect(fromBob.data.id).toBe(fromAlice.data.id);
  });

  it('rejects starting a conversation with yourself with 409', async () => {
    await expect(
      axios.post(
        '/api/v1/conversations',
        { username: alice.credentials.username },
        authHeader(alice.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('404s for a nonexistent username', async () => {
    await expect(
      axios.post(
        '/api/v1/conversations',
        { username: 'nobody_at_all_12345' },
        authHeader(alice.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.post('/api/v1/conversations', {
        username: bob.credentials.username,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('conversations: GET /conversations/:id', () => {
  it('returns the conversation for a participant', async () => {
    const created = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    const res = await axios.get(
      `/api/v1/conversations/${created.data.id}`,
      authHeader(alice.accessToken),
    );

    expect(res.status).toBe(200);
    expect(res.data.id).toBe(created.data.id);
  });

  it('rejects a non-participant with 403', async () => {
    const created = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    await expect(
      axios.get(
        `/api/v1/conversations/${created.data.id}`,
        authHeader(carol.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('404s for a nonexistent conversation', async () => {
    await expect(
      axios.get(
        `/api/v1/conversations/${crypto.randomUUID()}`,
        authHeader(alice.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });
});

describe('conversations: GET /conversations/:id/messages, POST /conversations/:id/messages', () => {
  let conversationId: string;

  beforeAll(async () => {
    const res = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );
    conversationId = res.data.id;
  });

  it('sends a message and returns the full message shape', async () => {
    const res = await axios.post(
      `/api/v1/conversations/${conversationId}/messages`,
      { body: 'Hey Bob!' },
      authHeader(alice.accessToken),
    );

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      conversationId,
      body: 'Hey Bob!',
      sender: { username: alice.credentials.username },
      readAt: null,
    });
  });

  it('paginates newest-first (walking into the past), each page already in chronological order', async () => {
    const bodies = ['first', 'second', 'third'];
    const orderedIds: string[] = [];
    for (const body of bodies) {
      const res = await axios.post(
        `/api/v1/conversations/${conversationId}/messages`,
        { body },
        authHeader(bob.accessToken),
      );
      orderedIds.push(res.data.id);
    }

    // Walking the cursor moves toward *older* messages, so each new page is
    // prepended, not appended, to reconstruct full chronological order.
    let allIds: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await axios.get(
        `/api/v1/conversations/${conversationId}/messages?limit=2${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        }`,
        authHeader(alice.accessToken),
      );
      allIds = [...page.data.data.map((m: { id: string }) => m.id), ...allIds];
      cursor = page.data.meta.nextCursor;
    } while (cursor);

    const positions = orderedIds.map((id) => allIds.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it('marks the recipient’s unread messages as read once they view the thread', async () => {
    await axios.post(
      `/api/v1/conversations/${conversationId}/messages`,
      { body: 'are you there' },
      authHeader(alice.accessToken),
    );

    await axios.get(
      `/api/v1/conversations/${conversationId}/messages`,
      authHeader(bob.accessToken),
    );

    const list = await axios.get(
      '/api/v1/conversations',
      authHeader(bob.accessToken),
    );
    const conversation = list.data.data.find(
      (c: { id: string }) => c.id === conversationId,
    );
    expect(conversation.unreadCount).toBe(0);
  });

  it('rejects a non-participant with 403 on both read and send', async () => {
    await expect(
      axios.get(
        `/api/v1/conversations/${conversationId}/messages`,
        authHeader(carol.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });

    await expect(
      axios.post(
        `/api/v1/conversations/${conversationId}/messages`,
        { body: 'sneaking in' },
        authHeader(carol.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('404s for a nonexistent conversation', async () => {
    await expect(
      axios.get(
        `/api/v1/conversations/${crypto.randomUUID()}/messages`,
        authHeader(alice.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects an empty message body with 400', async () => {
    await expect(
      axios.post(
        `/api/v1/conversations/${conversationId}/messages`,
        { body: '' },
        authHeader(alice.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.get(`/api/v1/conversations/${conversationId}/messages`),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('conversations: GET /conversations', () => {
  it('lists the caller’s conversations, newest activity first', async () => {
    const res = await axios.post(
      '/api/v1/conversations',
      { username: carol.credentials.username },
      authHeader(alice.accessToken),
    );
    await axios.post(
      `/api/v1/conversations/${res.data.id}/messages`,
      { body: 'hi carol' },
      authHeader(alice.accessToken),
    );

    const list = await axios.get(
      '/api/v1/conversations',
      authHeader(alice.accessToken),
    );

    expect(list.data.data[0].id).toBe(res.data.id);
    expect(list.data.data[0].lastMessage.body).toBe('hi carol');
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(axios.get('/api/v1/conversations')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});
