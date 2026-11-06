import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UnauthorizedError } from "@/lib/errors";
import { getEnvConfig } from "@/lib/config/env";

const SESSION_COOKIE_NAME = "slotbook_session";

function getEncodedKey(): Uint8Array {
  const secret = getEnvConfig().resolvedSessionSecret;
  return new TextEncoder().encode(secret);
}

export interface HostSessionPayload {
  hostId: string;
  email: string;
  name: string;
  slug: string;
  timezone: string;
  [key: string]: unknown;
}

/**
 * Encrypts host session payload into a signed JWT.
 */
export async function encryptSession(payload: HostSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedKey());
}

/**
 * Decrypts and verifies a session token.
 */
export async function decryptSession(
  token: string | undefined
): Promise<HostSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as HostSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Creates and sets an HTTP-only secure session cookie for the host.
 */
export async function createHostSession(payload: HostSessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

/**
 * Deletes the host session cookie.
 */
export async function deleteHostSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Retrieves and validates the current host session from cookies.
 */
export async function getHostSession(): Promise<HostSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return decryptSession(token);
}

/**
 * Requires an authenticated host session or throws UnauthorizedError.
 */
export async function requireHostSession(): Promise<HostSessionPayload> {
  const session = await getHostSession();
  if (!session || !session.hostId) {
    throw new UnauthorizedError("Authentication required: no active host session found.");
  }
  return session;
}

