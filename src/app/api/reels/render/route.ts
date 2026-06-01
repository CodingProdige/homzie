import { getServerSession } from "next-auth";

import { hasActiveAgentSubscription } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import {
  renderPayloadSchema,
  renderReelMedia,
} from "@/modules/reels/server/render-reel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to render a reel." }, { status: 401 });
  }

  if (!(await hasActiveAgentSubscription(session.user.id))) {
    return Response.json(
      { error: "An active agent subscription is required." },
      { status: 403 },
    );
  }

  const parsed = renderPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Check your reel edit." }, { status: 400 });
  }

  try {
    const rendered = await renderReelMedia(parsed.data);

    return Response.json(rendered);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not render this reel.",
      },
      { status: 500 },
    );
  }
}
