// --- pain-server session (populated by painServer.fetchLayerInfo) ---

/** `userId` from the last successful GET /init envelope (`PainServerInitResponse.userId`). */
let cachedPainServerUserId = "";

/** Store the user id after a successful {@link ./painServer.ts fetchLayerInfo} call. */
export function setPainServerUserId(userId: string): void {
  cachedPainServerUserId = userId;
}

/** User id from the last GET /init response, or `""` if not yet fetched. */
export function getPainServerUserId(): string {
  return cachedPainServerUserId;
}

/** Clear the cached user id (e.g. on logout or session reset). */
export function clearPainServerUserId(): void {
  cachedPainServerUserId = "";
}
