"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Users,
  Grid3x3,
  MapPin,
  AlertCircle,
  Info,
  ShieldAlert,
} from "lucide-react";
import { useAccessToken, useSetAccessToken } from "@/lib/TokenProvider";
import { useSession } from "@/lib/SessionContext";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type AlertType = "error" | "warning" | "info" | null;

interface AlertState {
  type: AlertType;
  message: string;
}

const ERROR_MAP: Record<
  string,
  { type: Exclude<AlertType, null>; message: string }
> = {
  INVALID_CREDENTIALS: { type: "error", message: "Invalid email or password" },
  PASSWORD_NOT_SET: {
    type: "info",
    message: "Account not activated. Contact your Chapter Admin.",
  },
  ACCOUNT_LOCKED: {
    type: "warning",
    message: "Account locked. Try again in 15 minutes.",
  },
  RATE_LIMIT_EXCEEDED: {
    type: "warning",
    message: "Too many attempts. Please try again later.",
  },
};

const FEATURES = [
  {
    icon: Users,
    title: "Smart 1-2-1s",
    description: "Automated member pairing with WhatsApp intros",
  },
  {
    icon: Grid3x3,
    title: "Engagement Matrix",
    description: "See your chapter's relationship network at a glance",
  },
  {
    icon: MapPin,
    title: "Member Map",
    description: "Discover nearby offices and plan your next 1-2-1",
  },
];

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

export default function LoginPage() {
  const router = useRouter();
  const accessToken = useAccessToken();
  const setAccessToken = useSetAccessToken();
  const { session, setSession } = useSession();

  // Only bounce when a valid in-memory access token is present.
  // This avoids redirect loops from stale client session metadata after DB reset.
  useEffect(() => {
    if (session && accessToken) {
      router.replace(
        LT_ROLES.includes(session.role) ? "/chapter" : "/chapter/members"
      );
    }
  }, [session, accessToken, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<AlertState>({ type: null, message: "" });
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset shake animation
  useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [shake]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert({ type: null, message: "" });
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setFieldErrors(errs);
      setShake(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data.error?.code ?? "UNKNOWN";
        const mapped = ERROR_MAP[code] ?? {
          type: "error" as const,
          message: "Something went wrong. Please try again.",
        };
        setAlert(mapped);
        setShake(true);
        return;
      }

      setAccessToken(data.data.accessToken);
      const member = data.data.member;
      setSession({
        memberId: member.member_id,
        chapterId: member.chapter_id,
        role: member.chapter_role,
      });
      router.push(
        LT_ROLES.includes(member.chapter_role) ? "/chapter" : "/chapter/members"
      );
    } catch {
      setAlert({
        type: "error",
        message: "Network error. Check your connection.",
      });
      setShake(true);
    } finally {
      setLoading(false);
    }
  }

  const isValid = email.length > 0 && password.length > 0;

  return (
    <div className="min-h-screen flex bg-white">
      {/* ═══════ Left Panel — Branded Hero (Desktop only) ═══════ */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900">
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden="true"
        />
        {/* Glow orbs */}
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-bni-blue-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-bni-blue-700/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-bni-blue-400 to-bni-blue-700 flex items-center justify-center font-bold text-white text-lg shadow-medium">
              B
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">
                BNI Connect
              </div>
              <div className="text-white/50 text-xs">Chapter Engagement</div>
            </div>
          </div>

          {/* Hero text */}
          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] mb-5 tracking-tight">
              Connect.
              <br />
              Grow.
              <br />
              <span className="bg-gradient-to-r from-bni-blue-300 to-white bg-clip-text text-transparent">
                Succeed.
              </span>
            </h1>
            <p className="text-white/70 text-base xl:text-lg leading-relaxed mb-10">
              The smart way to manage 1-2-1s, track engagement, and help every
              chapter member thrive.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                      <Icon
                        className="w-5 h-5 text-bni-blue-300"
                        strokeWidth={2.2}
                      />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">
                        {feature.title}
                      </div>
                      <div className="text-white/50 text-xs mt-0.5 leading-relaxed">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/30 text-xs">
            &copy; 2026 BNI Chapter Connect
          </div>
        </div>
      </aside>

      {/* ═══════ Right Panel — Login Form ═══════ */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bni-blue-400 to-bni-blue-700 flex items-center justify-center font-bold text-white text-2xl shadow-medium mb-3">
              B
            </div>
            <div className="text-navy font-bold text-lg">BNI Connect</div>
            <div className="text-slate-400 text-xs">Chapter Engagement</div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-headline text-navy mb-1.5">Welcome back</h2>
            <p className="text-sm text-slate-500">
              Sign in to your chapter account
            </p>
          </div>

          {/* Alert */}
          {alert.type && (
            <div
              className={`
                flex items-start gap-2.5 px-3.5 py-3 rounded-lg mb-5 animate-slide-up
                ${
                  alert.type === "error"
                    ? "bg-bni-red-50 text-bni-red-600 ring-1 ring-bni-red-100"
                    : alert.type === "warning"
                    ? "bg-bni-amber-50 text-bni-amber-600 ring-1 ring-bni-amber-100"
                    : "bg-bni-blue-50 text-bni-blue-700 ring-1 ring-bni-blue-100"
                }
              `}
              role="alert"
            >
              {alert.type === "error" && (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              {alert.type === "warning" && (
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              {alert.type === "info" && (
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
          )}

          {/* Form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className={`space-y-4 ${shake ? "animate-shake" : ""}`}
            noValidate
          >
            <Input
              label="Email"
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <div>
              <Input
                label="Password"
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pointer-events-auto hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
                required
              />
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  className="text-xs font-semibold text-bni-blue hover:underline"
                  onClick={() =>
                    setAlert({
                      type: "info",
                      message:
                        "Please contact your Chapter Admin to reset your password.",
                    })
                  }
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={loading}
              disabled={!isValid || loading}
              className="mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Footer text */}
          <p className="text-xs text-center text-slate-400 mt-8">
            Need help? Contact your{" "}
            <span className="font-semibold text-slate-500">Chapter Admin</span>
          </p>
        </div>
      </main>
    </div>
  );
}
