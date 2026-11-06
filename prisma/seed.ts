import { PrismaClient, DayOfWeek } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Production seed safety guard
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    console.warn("⚠️  [SAFETY NOTICE] Skipping automatic demo seed in production environment.");
    console.warn("   To run seed in production, set ALLOW_PRODUCTION_SEED=true and supply a secure SEED_HOST_PASSWORD.");
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEFAULT_DEMO_PASSWORD !== "true" &&
    (!process.env.SEED_HOST_PASSWORD || process.env.SEED_HOST_PASSWORD === "SlotbookDev2026!")
  ) {
    throw new Error(
      "Refusing to seed production with default demo password. Please supply a secure SEED_HOST_PASSWORD or set ALLOW_DEFAULT_DEMO_PASSWORD=true."
    );
  }

  console.log("🌱 Starting database seed...");

  const seedPassword = process.env.SEED_HOST_PASSWORD || "SlotbookDev2026!";
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  // 1. Seed demo host in Asia/Kolkata
  const host = await prisma.host.upsert({
    where: { email: "alex.slotbook@example.com" },
    update: {
      name: "Alex Sharma",
      slug: "alex-sharma",
      timezone: "Asia/Kolkata",
      passwordHash,
    },
    create: {
      name: "Alex Sharma",
      email: "alex.slotbook@example.com",
      slug: "alex-sharma",
      timezone: "Asia/Kolkata",
      passwordHash,
    },
  });
  console.log(`👤 Seeded Host: ${host.name} (${host.email}) [${host.timezone}]`);

  // 2. Seed two event types: 30-minute meeting and 60-minute consultation
  const meeting30 = await prisma.eventType.upsert({
    where: {
      hostId_slug: {
        hostId: host.id,
        slug: "30-min-meeting",
      },
    },
    update: {
      title: "30-Minute Meeting",
      description: "Quick 30-minute sync or discussion session.",
      duration: 30,
      bufferBefore: 5,
      bufferAfter: 5,
      location: "Google Meet",
      isActive: true,
    },
    create: {
      hostId: host.id,
      title: "30-Minute Meeting",
      slug: "30-min-meeting",
      description: "Quick 30-minute sync or discussion session.",
      duration: 30,
      bufferBefore: 5,
      bufferAfter: 5,
      location: "Google Meet",
      isActive: true,
    },
  });
  console.log(`📅 Seeded EventType: ${meeting30.title} (/${meeting30.slug})`);

  const consultation60 = await prisma.eventType.upsert({
    where: {
      hostId_slug: {
        hostId: host.id,
        slug: "60-min-consultation",
      },
    },
    update: {
      title: "60-Minute Consultation",
      description: "In-depth 60-minute strategy, advisory, or consultation session.",
      duration: 60,
      bufferBefore: 10,
      bufferAfter: 10,
      location: "Google Meet",
      isActive: true,
    },
    create: {
      hostId: host.id,
      title: "60-Minute Consultation",
      slug: "60-min-consultation",
      description: "In-depth 60-minute strategy, advisory, or consultation session.",
      duration: 60,
      bufferBefore: 10,
      bufferAfter: 10,
      location: "Google Meet",
      isActive: true,
    },
  });
  console.log(`📅 Seeded EventType: ${consultation60.title} (/${consultation60.slug})`);

  // 3. Monday-Friday availability 09:00-17:00
  const weekdays: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ];

  // In PostgreSQL TIME(3), represent time-of-day as standard 1970-01-01 UTC Date instants
  const defaultStartTime = new Date("1970-01-01T09:00:00.000Z");
  const defaultEndTime = new Date("1970-01-01T17:00:00.000Z");

  for (const day of weekdays) {
    await prisma.availability.upsert({
      where: {
        hostId_dayOfWeek_startTime_endTime: {
          hostId: host.id,
          dayOfWeek: day,
          startTime: defaultStartTime,
          endTime: defaultEndTime,
        },
      },
      update: {},
      create: {
        hostId: host.id,
        dayOfWeek: day,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
      },
    });
  }
  console.log(`⏰ Seeded Weekly Availability: Monday–Friday (09:00 – 17:00)`);

  // 4. At least one date override (Holiday / Unavailable Date + Custom Window)
  // Override 1: National holiday / Unavailable day (2026-12-25)
  const holidayDate = new Date("2026-12-25T00:00:00.000Z");
  const existingHoliday = await prisma.dateOverride.findFirst({
    where: {
      hostId: host.id,
      date: holidayDate,
      isUnavailable: true,
    },
  });

  if (!existingHoliday) {
    await prisma.dateOverride.create({
      data: {
        hostId: host.id,
        date: holidayDate,
        isUnavailable: true,
        startTime: null,
        endTime: null,
      },
    });
  }
  console.log(`🚫 Seeded DateOverride: 2026-12-25 (Unavailable all day)`);

  // Override 2: Custom reduced working hours (2026-12-24 half day: 09:00 - 13:00)
  const halfDayDate = new Date("2026-12-24T00:00:00.000Z");
  const halfDayStart = new Date("1970-01-01T09:00:00.000Z");
  const halfDayEnd = new Date("1970-01-01T13:00:00.000Z");

  const existingHalfDay = await prisma.dateOverride.findFirst({
    where: {
      hostId: host.id,
      date: halfDayDate,
      isUnavailable: false,
    },
  });

  if (existingHalfDay) {
    await prisma.dateOverride.update({
      where: { id: existingHalfDay.id },
      data: {
        startTime: halfDayStart,
        endTime: halfDayEnd,
      },
    });
  } else {
    await prisma.dateOverride.create({
      data: {
        hostId: host.id,
        date: halfDayDate,
        isUnavailable: false,
        startTime: halfDayStart,
        endTime: halfDayEnd,
      },
    });
  }
  console.log(`⚡ Seeded DateOverride: 2026-12-24 (Custom window: 09:00 – 13:00)`);

  console.log("✅ Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

