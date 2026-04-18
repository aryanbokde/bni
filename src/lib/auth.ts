import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AppError } from "./AppError";

export interface AuthContext {
  memberId: string;
  chapterId: string;
  role: string;
}

interface JwtPayload {
  memberId: string;
  chapterId: string;
  role: string;
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export function signAccessToken(payload: AuthContext): string {
  return jwt.sign(
    {
      memberId: payload.memberId,
      chapterId: payload.chapterId,
      role: payload.role,
    },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "15m" }
  );
}

export function signRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function verifyAccessToken(token: string): AuthContext {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    }) as JwtPayload;

    return {
      memberId: decoded.memberId,
      chapterId: decoded.chapterId,
      role: decoded.role,
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError("TOKEN_EXPIRED", 401);
    }
    throw new AppError("UNAUTHENTICATED", 401);
  }
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHENTICATED", 401);
  }
  const token = header.slice(7);
  return verifyAccessToken(token);
}

export function requireRole(actor: AuthContext, allowed: string[]): void {
  if (!allowed.includes(actor.role)) {
    throw new AppError("FORBIDDEN", 403);
  }
}
