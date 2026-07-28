// The only capability these modules need from `fetch` is its call signature.
// Typing an injection point as `typeof fetch` also demands the static
// `preconnect` property, which no caller uses and no test double carries —
// `vi.fn<typeof fetch>()` produces the call signature alone.
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
