import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt, hashPhone, hashEmail } from "../src/lib/crypto";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const DEMO_MEMBERS = [
  {
    full_name: "Rakesh Bokde",
    mobile: "+917489491430",
    whatsapp: "+917489491430",
    email: "rakeshcecs@gmail.com",
    biz_category: "Financial Services",
    one_line_summary: "Helping families secure their financial future through insurance and investments",
    intro_text: "I am Rakesh Patel from LIC, specializing in life insurance and retirement planning for 15+ years.",
    office_address: "301 Shivalik Complex, Satellite Road, Ahmedabad, Gujarat 380015",
    chapter_role: "PRESIDENT",
    latitude: 23.0258,
    longitude: 72.5073,
    joining_date: daysAgo(365),
  },
  {
    full_name: "Priya Sharma",
    mobile: "+919876543211",
    whatsapp: "+919876543211",
    email: "priya.sharma@demo.com",
    biz_category: "Interior Design",
    one_line_summary: "Creating beautiful living and workspace designs that inspire productivity and comfort",
    intro_text: "I am Priya Sharma, an award-winning interior designer with a passion for modern Indian aesthetics.",
    office_address: "12 Design Studio, CG Road, Navrangpura, Ahmedabad, Gujarat 380009",
    chapter_role: "VP",
    latitude: 23.0365,
    longitude: 72.5611,
    joining_date: daysAgo(300),
  },
  {
    full_name: "Amit Desai",
    mobile: "+919876543212",
    whatsapp: "+919876543212",
    email: "amit.desai@demo.com",
    biz_category: "IT Services",
    one_line_summary: "Custom software solutions and cloud migration for growing businesses",
    intro_text: null,
    office_address: "505 Titanium City Centre, Prahlad Nagar, Ahmedabad, Gujarat 380015",
    chapter_role: "SECRETARY",
    latitude: 23.0133,
    longitude: 72.5120,
    joining_date: daysAgo(250),
  },
  {
    full_name: "Neha Mehta",
    mobile: "+919876543213",
    whatsapp: "+919876543213",
    email: "neha.mehta@demo.com",
    biz_category: "Legal Services",
    one_line_summary: "Corporate law, real estate transactions, and business compliance advisory",
    intro_text: "I am Advocate Neha Mehta, practicing at Gujarat High Court with 12 years of experience.",
    office_address: "204 Law Chambers, Ashram Road, Ahmedabad, Gujarat 380009",
    chapter_role: "MEMBER",
    latitude: 23.0327,
    longitude: 72.5710,
    joining_date: daysAgo(200),
  },
  {
    full_name: "Vijay Singh",
    mobile: "+919876543214",
    whatsapp: "+919876543214",
    email: "vijay.singh@demo.com",
    biz_category: "Real Estate",
    one_line_summary: "Premium residential and commercial properties in Ahmedabad and Gandhinagar",
    intro_text: null,
    office_address: "Ground Floor, Safal Profitaire, Prahladnagar, Ahmedabad, Gujarat 380015",
    chapter_role: "MEMBER",
    latitude: 23.0100,
    longitude: 72.5146,
    joining_date: daysAgo(180),
  },
  {
    full_name: "Kavita Joshi",
    mobile: "+919876543215",
    whatsapp: "+919876543215",
    email: "kavita.joshi@demo.com",
    biz_category: "Digital Marketing",
    one_line_summary: "SEO, social media marketing, and lead generation for B2B businesses",
    intro_text: "I run a boutique digital marketing agency helping businesses grow their online presence.",
    office_address: "8th Floor, Shilp Epitome, South Bopal, Ahmedabad, Gujarat 380058",
    chapter_role: "MEMBER",
    latitude: 23.0213,
    longitude: 72.4735,
    joining_date: daysAgo(150),
  },
  {
    full_name: "Rajesh Gupta",
    mobile: "+919876543216",
    whatsapp: "+919876543216",
    email: "rajesh.gupta@demo.com",
    biz_category: "Chartered Accountant",
    one_line_summary: "Tax planning, GST compliance, and financial auditing for SMEs",
    intro_text: null,
    office_address: "302 Commerce House, Ashram Road, Ahmedabad, Gujarat 380014",
    chapter_role: "TREASURER",
    latitude: 23.0380,
    longitude: 72.5680,
    joining_date: daysAgo(330),
  },
  {
    full_name: "Meena Agarwal",
    mobile: "+919876543217",
    whatsapp: "+919876543217",
    email: "meena.agarwal@demo.com",
    biz_category: "Healthcare",
    one_line_summary: "Physiotherapy and wellness center specializing in sports injuries and post-surgery rehab",
    intro_text: "Dr. Meena Agarwal, MPT, running HealthFirst Physiotherapy Clinic since 2015.",
    office_address: "Vejalpur, Ahmedabad, Gujarat 380051",
    chapter_role: "MEMBER",
    latitude: 23.0002,
    longitude: 72.5185,
    joining_date: daysAgo(120),
  },
  {
    full_name: "Suresh Reddy",
    mobile: "+919876543218",
    whatsapp: "+919876543218",
    email: "suresh.reddy@demo.com",
    biz_category: "Printing & Packaging",
    one_line_summary: "Custom packaging solutions, brochure printing, and corporate branding materials",
    intro_text: null,
    office_address: "GIDC Industrial Estate, Vatva, Ahmedabad, Gujarat 382445",
    chapter_role: "MEMBER",
    latitude: 22.9725,
    longitude: 72.6260,
    joining_date: daysAgo(90),
  },
  {
    full_name: "Anita Shah",
    mobile: "+919876543219",
    whatsapp: "+919876543219",
    email: "anita.shah@demo.com",
    biz_category: "Education & Training",
    one_line_summary: "Corporate training, leadership workshops, and English communication skills",
    intro_text: "I help professionals become confident communicators through structured training programs.",
    office_address: "Satellite, Ahmedabad, Gujarat 380015",
    chapter_role: "MEMBER",
    latitude: null as number | null,
    longitude: null as number | null,
    joining_date: daysAgo(45),
  },
];

async function main() {
  // Find the existing chapter
  const chapter = await prisma.chapters.findFirst({
    where: { chapter_name: "Ahmedabad Central" },
  });

  if (!chapter) {
    console.error("Chapter 'Ahmedabad Central' not found. Run `npx prisma db seed` first.");
    process.exit(1);
  }

  console.log(`Using chapter: ${chapter.chapter_name} (${chapter.chapter_id})\n`);

  // ── CLEAN ALL existing data for this chapter ──
  console.log("Cleaning existing data...");
  await prisma.audit_logs.deleteMany({});
  await prisma.recommendations.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.recommendation_runs.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.member_interactions.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.members.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  console.log("Cleaned: audit_logs, recommendations, recommendation_runs, interactions, members\n");

  // Re-create Admin (deleted above)
  const passwordHash = bcrypt.hashSync("BNI@2026!", 10);
  const adminEmail = "admin@bnichapter.com";
  const adminMobile = "+910000000000";
  await prisma.members.create({
    data: {
      chapter_id: chapter.chapter_id,
      full_name: "Chapter Admin",
      mobile_enc: encrypt(adminMobile),
      mobile_hash: hashPhone(adminMobile),
      whatsapp_enc: encrypt(adminMobile),
      whatsapp_hash: hashPhone(adminMobile),
      email_enc: encrypt(adminEmail),
      email_hash: hashEmail(adminEmail),
      password_hash: passwordHash,
      biz_category: "Chapter Administration",
      one_line_summary: "Chapter Admin for Ahmedabad Central",
      office_address: "Ahmedabad, Gujarat",
      chapter_role: "ADMIN",
      status: "ACTIVE",
      joining_date: new Date(),
    },
  });
  console.log("  Created: Chapter Admin (ADMIN) — admin@bnichapter.com\n");

  // Create members
  const memberIds: string[] = [];

  for (const m of DEMO_MEMBERS) {
    const member = await prisma.members.create({
      data: {
        chapter_id: chapter.chapter_id,
        full_name: m.full_name,
        mobile_enc: encrypt(m.mobile),
        mobile_hash: hashPhone(m.mobile),
        whatsapp_enc: encrypt(m.whatsapp),
        whatsapp_hash: hashPhone(m.whatsapp),
        email_enc: encrypt(m.email),
        email_hash: hashEmail(m.email),
        password_hash: passwordHash,
        biz_category: m.biz_category,
        one_line_summary: m.one_line_summary,
        intro_text: m.intro_text,
        office_address: m.office_address,
        chapter_role: m.chapter_role,
        latitude: m.latitude,
        longitude: m.longitude,
        geocode_status: m.latitude ? "RESOLVED" : "PENDING",
        status: "ACTIVE",
        joining_date: m.joining_date,
      },
    });

    memberIds.push(member.member_id);
    console.log(`  Created: ${m.full_name} (${m.chapter_role}) — ${m.biz_category}`);
  }

  console.log(`\n${memberIds.length} members ready.\n`);

  // Seed interactions (some members have met)
  const interactions = [
    { a: 0, b: 1, daysAgo: 15 },   // Rakesh & Priya met 15 days ago
    { a: 0, b: 2, daysAgo: 30 },   // Rakesh & Amit met 30 days ago
    { a: 0, b: 3, daysAgo: 45 },   // Rakesh & Neha met 45 days ago
    { a: 1, b: 2, daysAgo: 20 },   // Priya & Amit met 20 days ago
    { a: 1, b: 5, daysAgo: 10 },   // Priya & Kavita met 10 days ago
    { a: 2, b: 6, daysAgo: 25 },   // Amit & Rajesh met 25 days ago
    { a: 3, b: 4, daysAgo: 60 },   // Neha & Vijay met 60 days ago
    { a: 3, b: 6, daysAgo: 35 },   // Neha & Rajesh met 35 days ago
    { a: 4, b: 5, daysAgo: 50 },   // Vijay & Kavita met 50 days ago
    { a: 5, b: 7, daysAgo: 8 },    // Kavita & Meena met 8 days ago
    { a: 6, b: 7, daysAgo: 40 },   // Rajesh & Meena met 40 days ago
    { a: 0, b: 8, daysAgo: 200 },  // Rakesh & Suresh met 200 days ago (outside 180d window)
  ];

  let ixCount = 0;
  for (const ix of interactions) {
    const aId = memberIds[ix.a];
    const bId = memberIds[ix.b];
    const sortedA = aId < bId ? aId : bId;
    const sortedB = aId < bId ? bId : aId;

    await prisma.member_interactions.create({
      data: {
        chapter_id: chapter.chapter_id,
        member_a_id: sortedA,
        member_b_id: sortedB,
        interaction_date: daysAgo(ix.daysAgo),
        source: "MANUAL",
      },
    });
    ixCount++;
  }
  console.log(`Created ${ixCount} interactions.\n`);

  // NO recommendations seeded — clean slate for cron testing

  // Summary
  console.log("=== DEMO DATA READY (No Pairs) ===");
  console.log(`Chapter:          ${chapter.chapter_name}`);
  console.log(`Members:          ${memberIds.length}`);
  console.log(`Interactions:     ${ixCount}`);
  console.log(`Recommendations:  0 (clean slate for cron testing)`);
  console.log("");
  console.log("All demo members can login with:");
  console.log("  Password: BNI@2026!");
  console.log("");
  console.log("Member logins:");
  for (const m of DEMO_MEMBERS) {
    console.log(`  ${m.full_name.padEnd(20)} → ${m.email}`);
  }
  console.log("\nAdmin login remains:");
  console.log("  admin@bnichapter.com / BNI@2026!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
