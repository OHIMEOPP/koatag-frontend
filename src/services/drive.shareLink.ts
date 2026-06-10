import driveApi, { unwrapDriveBody } from "api/driveAxios";

// R3 #4 §1.7 — share-link challenge/verify session token flow (per §3.17
// USER RE-LOCKED Option (a) Redis nonce 一次性消費 via Discord #1393).
//
// Flow:
//   1. POST /api/drive/share-links/{token}/challenge → server returns
//      32-byte nonce; server stores it Redis with short TTL keyed to token.
//   2. Client derives linkKey (Argon2id) + unwraps fileKey + signs the
//      nonce locally (or treats the unwrap success as the implicit proof).
//   3. POST /api/drive/share-links/{token}/verify with the nonce →
//      server DELs the Redis entry + issues a short-lived session_token.
//   4. Subsequent chunk manifest + chunk GETs include session_token.
//
// Backend confirms exact challenge/verify payload shape during R3 #4
// integration (frontend defaults to opaque nonce passthrough).

interface ChallengeResponse {
  nonce: string; // base64(32)
  challenge_exp: number; // unix seconds, e.g. now + 60s
}

interface VerifyResponse {
  session_token: string;
  session_exp: number; // unix seconds
}

export async function fetchShareLinkChallenge(token: string): Promise<ChallengeResponse> {
  const resp: any = await driveApi.post(
    `/drive/share-links/${encodeURIComponent(token)}/challenge`,
  );
  const { data } = unwrapDriveBody<ChallengeResponse>(resp.data);
  return data;
}

export async function verifyShareLinkChallenge(
  token: string,
  nonce: string,
): Promise<VerifyResponse> {
  const resp: any = await driveApi.post(
    `/drive/share-links/${encodeURIComponent(token)}/verify`,
    { nonce },
  );
  const { data } = unwrapDriveBody<VerifyResponse>(resp.data);
  return data;
}

export type { ChallengeResponse, VerifyResponse };
