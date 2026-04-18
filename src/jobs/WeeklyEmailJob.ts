import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

export class WeeklyEmailJob {
  static async run(): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log("[WeeklyEmailJob] SMTP not configured, skipping");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const chapters = await prisma.chapters.findMany({
      select: { chapter_id: true, chapter_name: true },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const chapter of chapters) {
      try {
        // Get LT members with emails
        const ltMembers = await prisma.members.findMany({
          where: {
            chapter_id: chapter.chapter_id,
            chapter_role: { in: LT_ROLES },
            status: "ACTIVE",
          },
          select: { full_name: true, email_enc: true },
        });

        if (ltMembers.length === 0) continue;

        // Compute weekly stats
        const [sentCount, completedCount, totalActive] = await Promise.all([
          prisma.recommendations.count({
            where: {
              chapter_id: chapter.chapter_id,
              status: "SENT",
              sent_at: { gte: oneWeekAgo },
            },
          }),
          prisma.recommendations.count({
            where: {
              chapter_id: chapter.chapter_id,
              status: "COMPLETED",
              completed_at: { gte: oneWeekAgo },
            },
          }),
          prisma.members.count({
            where: { chapter_id: chapter.chapter_id, status: "ACTIVE" },
          }),
        ]);

        // Count unique interactions this week
        const weekInteractions = await prisma.member_interactions.findMany({
          where: {
            chapter_id: chapter.chapter_id,
            interaction_date: { gte: oneWeekAgo },
          },
          select: { member_a_id: true, member_b_id: true },
        });
        const uniquePairs = new Set(
          weekInteractions.map((ix) =>
            ix.member_a_id < ix.member_b_id
              ? `${ix.member_a_id}|${ix.member_b_id}`
              : `${ix.member_b_id}|${ix.member_a_id}`
          )
        );

        // Build HTML email
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1B365D;">Weekly 1-2-1 Report — ${chapter.chapter_name}</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 12px; background: #f0fdf4; border-radius: 8px; text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${completedCount}</div>
                  <div style="font-size: 12px; color: #6b7280;">Completed</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="padding: 12px; background: #fffbeb; border-radius: 8px; text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #d97706;">${sentCount}</div>
                  <div style="font-size: 12px; color: #6b7280;">Sent This Week</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="padding: 12px; background: #eff6ff; border-radius: 8px; text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${uniquePairs.size}</div>
                  <div style="font-size: 12px; color: #6b7280;">1-2-1s This Week</div>
                </td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">
              Active members: ${totalActive}<br/>
              This is an automated weekly summary from BNI Chapter Connect.
            </p>
          </div>
        `;

        // Send to each LT member
        for (const lt of ltMembers) {
          const email = decrypt(Buffer.from(lt.email_enc));
          try {
            await transporter.sendMail({
              from: `"BNI Connect" <${smtpUser}>`,
              to: email,
              subject: `Weekly 1-2-1 Report — ${chapter.chapter_name}`,
              html,
            });
          } catch (err) {
            console.error(`[WeeklyEmailJob] Failed to send to ${lt.full_name}:`, err);
          }
        }

        console.log(
          `[WeeklyEmailJob] ${chapter.chapter_name}: sent to ${ltMembers.length} LT members ` +
          `(${sentCount} sent, ${completedCount} completed, ${uniquePairs.size} interactions this week)`
        );
      } catch (err) {
        console.error(`[WeeklyEmailJob] ${chapter.chapter_name} error:`, err);
      }
    }
  }
}
