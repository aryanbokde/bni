import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt, hashPhone, hashEmail } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  // (a) Create demo chapter
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "Ahmedabad Central",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      meeting_duration_mins: 90,
      timezone: "Asia/Kolkata",
      rsvp_reminder_schedule: [
        { offset_day: -1, time: "19:00" },
        { offset_day: 0, time: "06:00" },
      ],
      lookback_days: 180,
      cooldown_days: 60,
      max_recs_per_cycle: 3,
    },
  });

  console.log(`Created chapter: ${chapter.chapter_name} (${chapter.chapter_id})`);

  // (b) Seed shareable fields
  const fields = [
    { field_name: "full_name", is_shareable: true },
    { field_name: "biz_category", is_shareable: true },
    { field_name: "one_line_summary", is_shareable: true },
    { field_name: "intro_text", is_shareable: false },
    { field_name: "whatsapp", is_shareable: true },
    { field_name: "office_address", is_shareable: false },
  ];

  for (const field of fields) {
    await prisma.shareable_fields.create({
      data: {
        chapter_id: chapter.chapter_id,
        field_name: field.field_name,
        is_shareable: field.is_shareable,
      },
    });
  }

  console.log(`Seeded ${fields.length} shareable fields`);

  // (c) Create demo Admin member
  const email = "admin@bnichapter.com";
  const mobile = "+910000000000";
  const whatsapp = "+910000000000";

  await prisma.members.create({
    data: {
      chapter_id: chapter.chapter_id,
      full_name: "Chapter Admin",
      mobile_enc: encrypt(mobile),
      mobile_hash: hashPhone(mobile),
      whatsapp_enc: encrypt(whatsapp),
      whatsapp_hash: hashPhone(whatsapp),
      email_enc: encrypt(email),
      email_hash: hashEmail(email),
      password_hash: bcrypt.hashSync("BNI@2026!", 10),
      biz_category: "Chapter Administration",
      one_line_summary: "Chapter Admin for Ahmedabad Central",
      office_address: "Ahmedabad, Gujarat",
      chapter_role: "ADMIN",
      status: "ACTIVE",
      joining_date: new Date(),
    },
  });

  console.log("Created Admin member");

  console.log("\n=== FIRST LOGIN ===");
  console.log("Email:    admin@bnichapter.com");
  console.log("Password: BNI@2026!");
  console.log("Change this password immediately after first login!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
