import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

type AuthApiError = Error & {
  status?: number;
  statusCode?: number;
  body?: {
    message?: string;
    code?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required." },
        { status: 400 }
      );
    }

    const result = await auth.api.setPassword({
      headers: request.headers,
      body: { newPassword },
    });

    return NextResponse.json(result);
  } catch (error) {
    const authError = error as AuthApiError;
    const status = authError.statusCode || authError.status || 500;
    const message =
      authError.body?.message ||
      authError.message ||
      "We could not save your password right now.";

    console.error("[Set Password POST Error]:", error);

    return NextResponse.json(
      {
        error: message,
        code: authError.body?.code,
      },
      { status }
    );
  }
}
