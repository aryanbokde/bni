import { execSync } from "child_process";

const MYSQL = "C:/wamp64/bin/mysql/mysql8.3.0/bin/mysql.exe";

export default function globalSetup() {
  try {
    // Reset login lockout and refresh tokens
    execSync(
      `"${MYSQL}" -u root bnidb -e "UPDATE members SET failed_login_attempts=0, locked_until=NULL; DELETE FROM refresh_tokens;"`,
      { stdio: "pipe" }
    );

    // Clean up any test-created members (keep only the seed admin)
    execSync(
      `"${MYSQL}" -u root bnidb -e "DELETE FROM audit_logs WHERE entity_id IN (SELECT member_id FROM members WHERE full_name != 'Chapter Admin'); DELETE FROM members WHERE full_name != 'Chapter Admin';"`,
      { stdio: "pipe" }
    );

    // Reset the admin member status in case it was archived
    execSync(
      `"${MYSQL}" -u root bnidb -e "UPDATE members SET status='ACTIVE', comm_eligible=1, rec_active=1 WHERE full_name='Chapter Admin';"`,
      { stdio: "pipe" }
    );

    console.log("[global-setup] Database reset for e2e tests");
  } catch (e) {
    console.warn("[global-setup] DB reset failed:", e);
  }
}
