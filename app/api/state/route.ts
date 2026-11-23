import { NextResponse } from "next/server";
import { getAll } from "@/lib/repo";
import { withUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = withUser(async (_req, uid) => NextResponse.json(await getAll(uid)));
