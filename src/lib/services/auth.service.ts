import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError, NotFoundError } from "@/lib/errors";
import { LoginInput } from "@/lib/validations/auth.schema";

export interface AuthenticatedHost {
  id: string;
  name: string;
  email: string;
  slug: string;
  timezone: string;
}

/**
 * Validates host credentials and returns safe host profile.
 */
export async function loginHost(input: LoginInput): Promise<AuthenticatedHost> {
  const host = await prisma.host.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!host || !host.passwordHash) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  const isPasswordValid = await bcrypt.compare(input.password, host.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  return {
    id: host.id,
    name: host.name,
    email: host.email,
    slug: host.slug,
    timezone: host.timezone,
  };
}

/**
 * Retrieves host by ID, ensuring sensitive fields like passwordHash are omitted.
 */
export async function getAuthenticatedHost(hostId: string): Promise<AuthenticatedHost> {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: {
      id: true,
      name: true,
      email: true,
      slug: true,
      timezone: true,
    },
  });

  if (!host) {
    throw new NotFoundError("Host not found.");
  }

  return host;
}

