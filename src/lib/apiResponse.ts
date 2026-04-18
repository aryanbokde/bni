import { NextResponse } from "next/server";
import { AppError } from "./AppError";

export function ok(data: unknown, meta?: object): NextResponse {
  return NextResponse.json(meta ? { data, meta } : { data }, { status: 200 });
}

export function created(data: unknown): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function apiError(error: AppError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields && { fields: error.fields }),
      },
    },
    { status: error.httpStatus }
  );
}

export function withErrorHandling(
  handler: (req: Request, context: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: Request, context: { params: Record<string, string> }): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (err) {
      if (err instanceof AppError) {
        return apiError(err);
      }
      console.error("Unhandled error:", err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
        { status: 500 }
      );
    }
  };
}
