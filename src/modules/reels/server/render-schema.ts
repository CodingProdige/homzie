import { z } from "zod";

export const renderClipSchema = z.object({
  baseTrimStart: z.number().min(0).default(0),
  duration: z.number().min(0),
  id: z.string(),
  mediaPath: z.string(),
  muted: z.boolean().default(false),
  order: z.number().int().min(0),
  timelineStart: z.number(),
  trimEnd: z.number().min(0),
  trimStart: z.number().min(0),
  volume: z.number().min(0).max(1).default(1),
});

export const renderAudioClipSchema = z.object({
  baseTrimStart: z.number().min(0).default(0),
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
  id: z.string(),
  timelineStart: z.number(),
  trimEnd: z.number().min(0),
  trimStart: z.number().min(0),
});

export const renderPayloadSchema = z.object({
  audioClips: z.array(renderAudioClipSchema).default([]),
  audioMediaPath: z.string().optional(),
  audioVolume: z.number().min(0).max(1).default(1),
  clips: z.array(renderClipSchema).min(1),
});

export type RenderPayload = z.infer<typeof renderPayloadSchema>;
