import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, UnauthorizedError } from "@/lib/errors";
import { EventTypeInput } from "@/lib/validations/event-type.schema";

export async function listEventTypesForHost(hostId: string) {
  return prisma.eventType.findMany({
    where: { hostId },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getEventTypeForHost(hostId: string, eventTypeId: string) {
  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
  });

  if (!eventType) {
    throw new NotFoundError(`Event type with id '${eventTypeId}' not found.`);
  }

  if (eventType.hostId !== hostId) {
    throw new UnauthorizedError("You do not have permission to view or edit this event type.");
  }

  return eventType;
}

export async function createEventTypeForHost(hostId: string, input: EventTypeInput) {
  // Check for duplicate slug within this host
  const existing = await prisma.eventType.findUnique({
    where: {
      hostId_slug: {
        hostId,
        slug: input.slug,
      },
    },
  });

  if (existing) {
    throw new ValidationError(`You already have an event type with the slug '${input.slug}'. Please choose a different slug.`);
  }

  return prisma.eventType.create({
    data: {
      hostId,
      title: input.title,
      slug: input.slug,
      description: input.description?.trim() || null,
      duration: input.duration,
      bufferBefore: input.bufferBefore,
      bufferAfter: input.bufferAfter,
      location: input.location?.trim() || null,
      isActive: input.isActive,
    },
  });
}

export async function updateEventTypeForHost(
  hostId: string,
  eventTypeId: string,
  input: Partial<EventTypeInput>
) {
  const current = await getEventTypeForHost(hostId, eventTypeId);

  // If slug is being changed, verify uniqueness
  if (input.slug && input.slug !== current.slug) {
    const existing = await prisma.eventType.findUnique({
      where: {
        hostId_slug: {
          hostId,
          slug: input.slug,
        },
      },
    });

    if (existing && existing.id !== eventTypeId) {
      throw new ValidationError(`You already have an event type with the slug '${input.slug}'. Please choose a different slug.`);
    }
  }

  return prisma.eventType.update({
    where: { id: eventTypeId },
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      duration: input.duration,
      bufferBefore: input.bufferBefore,
      bufferAfter: input.bufferAfter,
      location: input.location !== undefined ? input.location?.trim() || null : undefined,
      isActive: input.isActive,
    },
  });
}

export async function deleteOrArchiveEventTypeForHost(hostId: string, eventTypeId: string) {
  const eventType = await getEventTypeForHost(hostId, eventTypeId);

  const bookingCount = await prisma.booking.count({
    where: { eventTypeId },
  });

  if (bookingCount > 0) {
    // Has historical bookings: deactivate rather than cascade deleting
    const updated = await prisma.eventType.update({
      where: { id: eventTypeId },
      data: { isActive: false },
    });

    return {
      action: "archived" as const,
      message: `Event type '${eventType.title}' has ${bookingCount} historical booking(s) and has been deactivated to preserve records.`,
      eventType: updated,
    };
  }

  // No bookings exist: safe to delete
  await prisma.eventType.delete({
    where: { id: eventTypeId },
  });

  return {
    action: "deleted" as const,
    message: `Event type '${eventType.title}' has been deleted.`,
  };
}

