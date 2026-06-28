"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { broadcastCampaigns, emailDeliveryLogs, users } from "@/db/schema";
import { countBroadcastAudience } from "@/modules/broadcasts/audience";
import {
  normalizeBroadcastAudience,
  normalizeBroadcastBlocks,
  queueBroadcastCampaign,
  renderBroadcastParts,
} from "@/modules/broadcasts/server";
import {
  liveBroadcastSubject,
  testBroadcastSubject,
} from "@/modules/broadcasts/subject";
import { defaultBroadcastBlocks } from "@/modules/broadcasts/types";
import { authOptions } from "@/modules/auth/config";
import { sendSendGridEmail } from "@/modules/email/sendgrid";

export type BroadcastActionState = {
  campaignId?: string;
  message: string;
  ok: boolean;
};

const emptyBroadcastActionState: BroadcastActionState = {
  message: "",
  ok: false,
};

const saveSchema = z.object({
  audienceJson: z.string().trim().min(1),
  blocksJson: z.string().trim().min(1),
  campaignId: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Campaign name is required.").max(140),
  preheader: z.string().trim().max(240).optional(),
  subject: z.string().trim().min(2, "Subject is required.").max(180),
});

const testSchema = saveSchema.extend({
  recipientEmail: z.string().trim().toLowerCase().email("Enter a test recipient."),
});

async function requireAdminUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in as an admin.");
  }

  const [admin] = await db
    .select({
      email: users.email,
      id: users.id,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Only active admins can manage broadcasts.");
  }

  return admin;
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseCampaignForm(formData: FormData) {
  const parsed = saveSchema.safeParse({
    audienceJson: formValue(formData, "audienceJson"),
    blocksJson: formValue(formData, "blocksJson"),
    campaignId: formValue(formData, "campaignId") || undefined,
    name: formValue(formData, "name"),
    preheader: formValue(formData, "preheader"),
    subject: formValue(formData, "subject"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Check the campaign fields.");
  }

  const audience = normalizeBroadcastAudience(parseJson(parsed.data.audienceJson));
  const blocks = normalizeBroadcastBlocks(parseJson(parsed.data.blocksJson));
  const subject = liveBroadcastSubject(parsed.data.subject);

  if (!subject) {
    throw new Error("Subject is required.");
  }

  if (!blocks.length) {
    throw new Error("Add at least one content block.");
  }

  return {
    ...parsed.data,
    audience,
    blocks,
    subject,
  };
}

export async function saveBroadcastCampaignAction(
  _prevState: BroadcastActionState = emptyBroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  void _prevState;

  try {
    const admin = await requireAdminUser();
    const data = parseCampaignForm(formData);
    const audienceCount = await countBroadcastAudience(data.audience);
    const rendered = renderBroadcastParts({
      blocks: data.blocks,
      preheader: data.preheader,
    });

    if (data.campaignId) {
      const [existing] = await db
        .select({
          id: broadcastCampaigns.id,
          status: broadcastCampaigns.status,
        })
        .from(broadcastCampaigns)
        .where(eq(broadcastCampaigns.id, data.campaignId))
        .limit(1);

      if (!existing) {
        throw new Error("Broadcast campaign not found.");
      }

      if (existing.status === "sending" || existing.status === "sent") {
        throw new Error("Duplicate this broadcast before editing sent content.");
      }

      await db
        .update(broadcastCampaigns)
        .set({
          audience: data.audience,
          blocks: data.blocks,
          html: rendered.html,
          lastAudienceCount: audienceCount,
          name: data.name,
          preheader: data.preheader || null,
          subject: data.subject,
          text: rendered.text,
          updatedAt: new Date(),
          updatedByUserId: admin.id,
        })
        .where(eq(broadcastCampaigns.id, data.campaignId));

      revalidatePath("/admin/broadcasts");
      revalidatePath(`/admin/broadcasts/${data.campaignId}`);

      return {
        campaignId: data.campaignId,
        message: `Draft saved. Current audience: ${audienceCount}.`,
        ok: true,
      };
    }

    const [campaign] = await db
      .insert(broadcastCampaigns)
      .values({
        audience: data.audience,
        blocks: data.blocks,
        createdByUserId: admin.id,
        html: rendered.html,
        lastAudienceCount: audienceCount,
        name: data.name,
        preheader: data.preheader || null,
        subject: data.subject,
        text: rendered.text,
        updatedByUserId: admin.id,
      })
      .returning({ id: broadcastCampaigns.id });

    revalidatePath("/admin/broadcasts");

    return {
      campaignId: campaign.id,
      message: `Draft created. Current audience: ${audienceCount}.`,
      ok: true,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Could not save broadcast.",
      ok: false,
    };
  }
}

export async function sendBroadcastTestAction(
  _prevState: BroadcastActionState = emptyBroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  void _prevState;

  try {
    await requireAdminUser();

    const parsed = testSchema.safeParse({
      audienceJson: formValue(formData, "audienceJson"),
      blocksJson: formValue(formData, "blocksJson"),
      campaignId: formValue(formData, "campaignId") || undefined,
      name: formValue(formData, "name"),
      preheader: formValue(formData, "preheader"),
      recipientEmail: formValue(formData, "recipientEmail"),
      subject: formValue(formData, "subject"),
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || "Check the test fields.");
    }

    const blocks = normalizeBroadcastBlocks(parseJson(parsed.data.blocksJson));
    if (!blocks.length) throw new Error("Add at least one content block.");
    const subject = testBroadcastSubject(parsed.data.subject);

    const rendered = renderBroadcastParts({
      blocks,
      preheader: parsed.data.preheader,
    });

    const delivery = await sendSendGridEmail({
      categories: ["broadcast-test"],
      html: rendered.html,
      subject,
      text: rendered.text,
      to: { email: parsed.data.recipientEmail },
    });

    await db.insert(emailDeliveryLogs).values({
      eventKey: "broadcast_test",
      providerMessageId: delivery.messageId,
      recipientEmail: parsed.data.recipientEmail,
      sentAt: new Date(),
      status: "sent",
      subject,
      templateKey: "broadcast_test",
      variables: { campaignId: parsed.data.campaignId || null },
    });

    return {
      campaignId: parsed.data.campaignId,
      message: `Test sent to ${parsed.data.recipientEmail}.`,
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Could not send the test broadcast.",
      ok: false,
    };
  }
}

export async function sendBroadcastCampaignAction(
  _prevState: BroadcastActionState = emptyBroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  void _prevState;

  try {
    const admin = await requireAdminUser();
    const campaignId = z.string().uuid().parse(formValue(formData, "campaignId"));
    const result = await queueBroadcastCampaign({
      adminUserId: admin.id,
      campaignId,
    });

    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${campaignId}`);

    return {
      campaignId,
      message: `Broadcast queued for ${result.recipientCount} recipients. Batches will send in the background.`,
      ok: true,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Could not send broadcast.",
      ok: false,
    };
  }
}

export async function scheduleBroadcastCampaignAction(
  _prevState: BroadcastActionState = emptyBroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  void _prevState;

  try {
    const admin = await requireAdminUser();
    const campaignId = z.string().uuid().parse(formValue(formData, "campaignId"));
    const scheduledAtValue = formValue(formData, "scheduledAt");
    const scheduledAt = new Date(scheduledAtValue);

    if (!scheduledAtValue || Number.isNaN(scheduledAt.getTime())) {
      throw new Error("Choose a valid schedule time.");
    }

    if (scheduledAt <= new Date()) {
      throw new Error("Choose a future schedule time.");
    }

    await db
      .update(broadcastCampaigns)
      .set({
        scheduledAt,
        status: "scheduled",
        updatedAt: new Date(),
        updatedByUserId: admin.id,
      })
      .where(eq(broadcastCampaigns.id, campaignId));

    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${campaignId}`);

    return {
      campaignId,
      message: "Broadcast scheduled.",
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Could not schedule broadcast.",
      ok: false,
    };
  }
}

export async function duplicateBroadcastCampaignAction(formData: FormData) {
  const admin = await requireAdminUser();
  const campaignId = z.string().uuid().parse(formValue(formData, "campaignId"));
  const [campaign] = await db
    .select()
    .from(broadcastCampaigns)
    .where(eq(broadcastCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error("Broadcast campaign not found.");
  }

  const [copy] = await db
    .insert(broadcastCampaigns)
    .values({
      audience: normalizeBroadcastAudience(campaign.audience),
      blocks: normalizeBroadcastBlocks(campaign.blocks),
      createdByUserId: admin.id,
      html: campaign.html,
      lastAudienceCount: campaign.lastAudienceCount,
      name: `Copy of ${campaign.name}`.slice(0, 140),
      preheader: campaign.preheader,
      subject: liveBroadcastSubject(campaign.subject),
      text: campaign.text,
      updatedByUserId: admin.id,
    })
    .returning({ id: broadcastCampaigns.id });

  revalidatePath("/admin/broadcasts");

  redirect(`/admin/broadcasts/${copy.id}`);
}

export async function createBlankBroadcastCampaignAction() {
  const admin = await requireAdminUser();
  const blocks = defaultBroadcastBlocks;
  const rendered = renderBroadcastParts({ blocks, preheader: "" });
  const [campaign] = await db
    .insert(broadcastCampaigns)
    .values({
      blocks,
      createdByUserId: admin.id,
      html: rendered.html,
      name: "Untitled broadcast",
      subject: "A fresh Homzie update",
      text: rendered.text,
      updatedByUserId: admin.id,
    })
    .returning({ id: broadcastCampaigns.id });

  revalidatePath("/admin/broadcasts");

  redirect(`/admin/broadcasts/${campaign.id}`);
}
