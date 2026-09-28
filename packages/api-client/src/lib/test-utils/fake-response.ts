/** The subset of `Response` `HttpClient` actually touches — enough to mock `fetch` without a real network layer. */
export function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}
