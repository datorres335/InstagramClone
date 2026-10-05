import axios from 'axios';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real SSE pipeline (Milestone 22, docs/API.md §18) end to
 * end — a genuine HTTP streaming connection against the live server, not a
 * mocked `EventsService`. Reads raw `data:` lines off the response stream
 * the same way a real `EventSource`/`react-native-sse` client would, rather
 * than reaching into server internals.
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

/**
 * Opens a real `GET /events` stream and exposes a `next()` that resolves
 * with the next real (non-heartbeat) payload. Heartbeats arrive as a named
 * `event: heartbeat` with an empty `data:` line (see `EventsController`) —
 * filtered out here the same way a real client would ignore an event type
 * it doesn't care about.
 */
function openEventStream(accessToken: string) {
  const controller = new AbortController();
  const queued: unknown[] = [];
  const waiters: ((value: unknown) => void)[] = [];
  let buffer = '';

  function handleChunk(chunk: Buffer) {
    buffer += chunk.toString('utf8');
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const dataLine = block
        .split('\n')
        .find((line) => line.startsWith('data:'));
      const payload = dataLine?.slice('data:'.length).trim();
      if (!payload) continue; // heartbeat (or any comment-only block)
      const parsed = JSON.parse(payload);
      const waiter = waiters.shift();
      if (waiter) waiter(parsed);
      else queued.push(parsed);
    }
  }

  const ready = axios
    .get('/api/v1/events', {
      ...authHeader(accessToken),
      responseType: 'stream',
      signal: controller.signal,
    })
    .then((res) => {
      res.data.on('data', handleChunk);
    });

  return {
    ready,
    next(timeoutMs = 10_000): Promise<unknown> {
      if (queued.length > 0) return Promise.resolve(queued.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Timed out waiting for an SSE event')),
          timeoutMs,
        );
        waiters.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
    },
    close() {
      controller.abort();
    },
  };
}

describe('events: GET /events', () => {
  it('rejects an unauthenticated request with 401', async () => {
    await expect(axios.get('/api/v1/events')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('pushes a message event to a connected recipient without them polling', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const conversation = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    const stream = openEventStream(bob.accessToken);
    await stream.ready;

    await axios.post(
      `/api/v1/conversations/${conversation.data.id}/messages`,
      { body: 'hi bob, live!' },
      authHeader(alice.accessToken),
    );

    const event = (await stream.next()) as {
      type: string;
      message: { body: string; sender: { username: string } };
    };
    expect(event).toMatchObject({
      type: 'message',
      message: {
        body: 'hi bob, live!',
        sender: { username: alice.credentials.username },
      },
    });

    stream.close();
  }, 15_000);

  it('never pushes a message event back to the sender', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const conversation = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    const stream = openEventStream(alice.accessToken);
    await stream.ready;

    await axios.post(
      `/api/v1/conversations/${conversation.data.id}/messages`,
      { body: 'talking to myself?' },
      authHeader(alice.accessToken),
    );

    await expect(stream.next(2_000)).rejects.toThrow('Timed out');
    stream.close();
  }, 15_000);

  it('still catches up on a missed message via REST after being disconnected', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const conversation = await axios.post(
      '/api/v1/conversations',
      { username: bob.credentials.username },
      authHeader(alice.accessToken),
    );

    // bob never connects to /events at all for this message — simulating a
    // disconnected/reconnecting client that must not assume zero missed
    // events, per Milestone 22's design requirement.
    await axios.post(
      `/api/v1/conversations/${conversation.data.id}/messages`,
      { body: 'you missed this live, but not for long' },
      authHeader(alice.accessToken),
    );

    const messages = await axios.get(
      `/api/v1/conversations/${conversation.data.id}/messages`,
      authHeader(bob.accessToken),
    );
    expect(messages.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: 'you missed this live, but not for long' }),
      ]),
    );
  }, 15_000);
});
