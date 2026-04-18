import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAuth, requireRole } from "@/lib/auth";
import { AppError, isAppError } from "@/lib/AppError";
import { apiError } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import * as MatrixService from "@/services/MatrixService";
import { decryptMember } from "@/services/memberHelpers";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// GET /api/chapters/[chapterId]/recommendations/export
export async function GET(
  req: Request,
  { params }: { params: Record<string, string> }
) {
  try {
  const actor = await requireAuth(req);
  requireRole(actor, LT_ROLES);
  if (actor.chapterId !== params.chapterId) {
    throw new AppError("FORBIDDEN", 403);
  }

  const url = new URL(req.url);
  const windowDays = Number(url.searchParams.get("windowDays")) || 180;

  // --- Sheet 1: Matrix ---
  const matrixData = await MatrixService.getMatrix(params.chapterId, windowDays);
  const { members, cells } = matrixData;

  const wb = new ExcelJS.Workbook();
  const ws1 = wb.addWorksheet("Matrix");

  // Header row: empty cell + member names
  const headerRow = [""].concat(members.map((m) => m.full_name));
  ws1.addRow(headerRow);

  // Style header
  const hRow = ws1.getRow(1);
  hRow.font = { bold: true, size: 9 };
  hRow.alignment = { textRotation: 90 };

  // Data rows
  for (let i = 0; i < members.length; i++) {
    const rowData: string[] = [members[i].full_name];
    for (let j = 0; j < members.length; j++) {
      const cell = cells[i][j];
      if (cell.state === "SELF") rowData.push("—");
      else if (cell.state === "GREEN") rowData.push("✓");
      else if (cell.state === "AMBER") rowData.push("⏳");
      else if (cell.state === "EXCLUDED") rowData.push("✕");
      else rowData.push("");
    }
    const row = ws1.addRow(rowData);
    row.getCell(1).font = { bold: true, size: 9 };

    // Color cells
    for (let j = 0; j < members.length; j++) {
      const excelCell = row.getCell(j + 2); // +2 because col 1 is name
      const state = cells[i][j].state;
      if (state === "GREEN") {
        excelCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC6EFCE" },
        };
      } else if (state === "AMBER") {
        excelCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFEB9C" },
        };
      } else if (state === "SELF") {
        excelCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD3D3D3" },
        };
      }
      excelCell.alignment = { horizontal: "center" };
      excelCell.font = { size: 9 };
    }
  }

  // Auto-fit first column
  ws1.getColumn(1).width = 20;
  for (let c = 2; c <= members.length + 1; c++) {
    ws1.getColumn(c).width = 4;
  }

  // --- Sheet 2: Pipeline ---
  const ws2 = wb.addWorksheet("Pipeline");

  ws2.addRow([
    "Rec ID",
    "Member A",
    "Member B",
    "Status",
    "Sent At",
    "Completed At",
    "Expired At",
  ]);
  ws2.getRow(1).font = { bold: true };

  const recs = await prisma.recommendations.findMany({
    where: { chapter_id: params.chapterId },
    orderBy: { sent_at: "desc" },
    take: 500,
  });

  // Build member name lookup
  const memberMap = new Map<string, string>();
  const allMembers = await prisma.members.findMany({
    where: { chapter_id: params.chapterId },
  });
  for (const m of allMembers) {
    const dec = decryptMember(m);
    memberMap.set(m.member_id, dec.full_name);
  }

  for (const r of recs) {
    ws2.addRow([
      r.rec_id,
      memberMap.get(r.member_a_id) ?? r.member_a_id,
      memberMap.get(r.member_b_id) ?? r.member_b_id,
      r.status,
      r.sent_at?.toISOString() ?? "",
      r.completed_at?.toISOString() ?? "",
      r.expired_at?.toISOString() ?? "",
    ]);
  }

  // Auto-fit columns
  ws2.getColumn(1).width = 38;
  ws2.getColumn(2).width = 20;
  ws2.getColumn(3).width = 20;
  ws2.getColumn(4).width = 12;
  ws2.getColumn(5).width = 22;
  ws2.getColumn(6).width = 22;
  ws2.getColumn(7).width = 22;

  // Write to buffer
  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="matrix_export_${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
  } catch (err) {
    if (isAppError(err)) return apiError(err);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, { status: 500 });
  }
}
