"use client";

import Image from "next/image";
import Link from "next/link";
import EmojiPicker, {
  EmojiStyle,
  SkinTonePickerLocation,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  CircleOff,
  Edit,
  ImageIcon,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptConversationRequestAction,
  blockUserAction,
  deleteConversationAction,
  loadConversationAction,
  markConversationReadAction,
  markMessageDeliveredAction,
  reportConversationAction,
  respondToOfferAction,
  sendAttachmentMessageAction,
  sendMessageAction,
  setConversationMutedAction,
  startConversationAction,
} from "@/modules/messages/actions";
import type {
  ConversationSummary,
  MessageThreadItem,
  MessageUser,
} from "@/modules/messages/server";
import { getMessageSocketUrl } from "@/modules/messages/socket-url";

type UserSearchResult = {
  avatarUrl: string | null;
  id?: string;
  name: string;
  username: string;
};

type MessagesPageProps = {
  conversations: ConversationSummary[];
  initialConversationId: string | null;
  messages: MessageThreadItem[];
  viewer: MessageUser;
};

type VoicePreview = {
  blob: Blob;
  durationSeconds: number;
  url: string;
  waveform: number[];
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

function UserAvatar({
  className,
  user,
}: {
  className?: string;
  user: MessageUser | UserSearchResult | null;
}) {
  const name = user?.name || "Homzie User";

  return (
    <span
      className={cn(
        "relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--homzie-gradient)] p-0.5 text-white",
        className,
      )}
    >
      {user?.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt={name}
          width={56}
          height={56}
          className="size-full rounded-full border-2 border-background object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center rounded-full border-2 border-background bg-brand-midnight text-xs font-semibold">
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function formatTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs < minute) return "now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function offerLabel(amountCents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amountCents / 100);
}

function conversationTitle(conversation: ConversationSummary | null) {
  if (!conversation) return "Messages";

  return (
    conversation.otherParticipants.map((participant) => participant.name).join(", ") ||
    "Homzie User"
  );
}

function DeliveryTicks({ status }: { status: MessageThreadItem["status"] }) {
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-primary" />;
  }

  if (status === "delivered") {
    return <CheckCheck className="size-3.5 text-muted-foreground" />;
  }

  return <Check className="size-3.5 text-muted-foreground" />;
}

export function MessagesPage({
  conversations: initialConversations,
  initialConversationId,
  messages: initialMessages,
  viewer,
}: MessagesPageProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(
    initialConversationId,
  );
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [activeInbox, setActiveInbox] = useState<"chats" | "requests">("chats");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(initialConversationId));
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState<VoicePreview | null>(null);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>(
    Array.from({ length: 24 }, () => 0.22),
  );
  const [isPending, startTransition] = useTransition();
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingAnimationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const discardRecordingRef = useRef(false);
  const voiceWaveformRef = useRef<number[]>(voiceWaveform);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [activeConversationId, conversations],
  );
  const activeParticipant = activeConversation?.otherParticipants[0] || null;
  const filteredConversations = conversations.filter((conversation) => {
    const search = query.trim().toLowerCase();
    const inboxMatches =
      activeInbox === "requests"
        ? conversation.inbox === "requests"
        : conversation.inbox !== "requests";

    if (!inboxMatches) return false;

    if (!search) return true;

    return (
      conversationTitle(conversation).toLowerCase().includes(search) ||
      conversation.lastMessagePreview.toLowerCase().includes(search)
    );
  });
  const someoneTyping = typingUserIds.some((id) => id !== viewer.id);
  const activeParticipantOnline =
    activeParticipant && onlineUserIds.includes(activeParticipant.id);
  const requestCount = conversations.filter(
    (conversation) => conversation.inbox === "requests",
  ).length;

  const refreshConversation = useCallback(
    (conversationId = activeConversationId) => {
      if (!conversationId) return;

      startTransition(async () => {
        const result = await loadConversationAction({ conversationId });

        setConversations(result.conversations);
        setMessages(result.messages);
      });
    },
    [activeConversationId],
  );

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;

    markConversationReadAction({ conversationId: activeConversationId }).then(
      (result) => setConversations(result.conversations),
    );
  }, [activeConversationId]);

  useEffect(() => {
    if (!emojiPickerOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        emojiPickerRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target) ||
        messageInputRef.current?.contains(target)
      ) {
        return;
      }

      setEmojiPickerOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [emojiPickerOpen]);

  useEffect(() => {
    voiceWaveformRef.current = voiceWaveform;
  }, [voiceWaveform]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }

      if (recordingAnimationRef.current) {
        window.cancelAnimationFrame(recordingAnimationRef.current);
      }

      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
      if (voicePreview?.url) {
        URL.revokeObjectURL(voicePreview.url);
      }
    };
  }, [voicePreview]);

  useEffect(() => {
    const socket = io(getMessageSocketUrl(), {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      const conversationId = activeConversationIdRef.current;

      if (conversationId) {
        socket.emit("conversation:join", conversationId);
      }
    });

    socket.on("message.created", (event) => {
      if (
        event.messageId &&
        event.conversationId === activeConversationIdRef.current
      ) {
        markMessageDeliveredAction({ messageId: event.messageId });
        refreshConversation(event.conversationId);
      } else {
        startTransition(async () => {
          const result = await loadConversationAction({
            conversationId: event.conversationId,
          });

          setConversations(result.conversations);
        });
      }
    });

    socket.on("conversation.read", (event) => {
      if (event.conversationId === activeConversationIdRef.current) {
        if (event.readerUserId !== viewer.id) {
          const readAt = new Date(event.readAt).getTime();

          setMessages((current) =>
            current.map((message) =>
              message.senderUserId === viewer.id &&
              new Date(message.createdAt).getTime() <= readAt
                ? { ...message, status: "read" }
                : message,
            ),
          );
        }

        refreshConversation(event.conversationId);
      }
    });

    socket.on("message.delivered", (event) => {
      if (event.conversationId === activeConversationIdRef.current) {
        if (event.userId !== viewer.id) {
          setMessages((current) =>
            current.map((message) =>
              message.id === event.messageId &&
              message.senderUserId === viewer.id &&
              message.status !== "read"
                ? { ...message, status: "delivered" }
                : message,
            ),
          );
        }

        refreshConversation(event.conversationId);
      }
    });

    socket.on("typing:start", (event) => {
      if (event.conversationId !== activeConversationIdRef.current) return;

      setTypingUserIds((current) =>
        current.includes(event.userId) ? current : [...current, event.userId],
      );
    });

    socket.on("typing:stop", (event) => {
      setTypingUserIds((current) => current.filter((id) => id !== event.userId));
    });

    socket.on("presence:update", (event) => {
      setOnlineUserIds((current) => {
        if (event.online) {
          return current.includes(event.userId) ? current : [...current, event.userId];
        }

        return current.filter((id) => id !== event.userId);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [refreshConversation, viewer.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversationId) return;

    socket.emit("conversation:join", activeConversationId);

    return () => {
      socket.emit("conversation:leave", activeConversationId);
    };
  }, [activeConversationId]);

  function selectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setMobileThreadOpen(true);
    setDetailsOpen(false);
    refreshConversation(conversationId);
  }

  function sendCurrentMessage() {
    const cleanBody = body.trim();
    const conversationId = activeConversationId;

    if (!cleanBody || !conversationId) return;

    const clientId = crypto.randomUUID();
    setBody("");

    const optimisticMessage: MessageThreadItem = {
      attachments: [],
      body: cleanBody,
      clientId,
      conversationId,
      createdAt: new Date().toISOString(),
      id: clientId,
      offer: null,
      sender: viewer,
      senderUserId: viewer.id,
      status: "sent",
      type: "text",
    };

    setMessages((current) => [...current, optimisticMessage]);

    startTransition(async () => {
      const result = await sendMessageAction({
        body: cleanBody,
        clientId,
        conversationId,
      });

      setConversations(result.conversations);
      setMessages(result.messages);
    });
  }

  function respondToOffer(offerId: string, status: "accepted" | "declined") {
    startTransition(async () => {
      const result = await respondToOfferAction({ offerId, status });

      setConversations(result.conversations);
      setMessages(result.messages);
      setActiveConversationId(result.conversationId);
    });
  }

  function handleTyping(value: string) {
    setBody(value);

    if (!activeConversationId) return;

    socketRef.current?.emit("typing:start", { conversationId: activeConversationId });

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socketRef.current?.emit("typing:stop", {
        conversationId: activeConversationId,
      });
    }, 900);
  }

  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;
    const selectionStart = input?.selectionStart ?? body.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextBody =
      body.slice(0, selectionStart) + emoji + body.slice(selectionEnd);
    const nextCursor = selectionStart + emoji.length;

    handleTyping(nextBody);
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function sendMediaMessage(mediaType: "audio" | "image" | "voice", file: Blob | File) {
    const conversationId = activeConversationId;

    if (!conversationId) return;

    const formData = new FormData();
    formData.append("clientId", crypto.randomUUID());
    formData.append("conversationId", conversationId);
    formData.append("file", file);
    formData.append("mediaType", mediaType);

    startTransition(async () => {
      const result = await sendAttachmentMessageAction(formData);

      setConversations(result.conversations);
      setMessages(result.messages);
    });
  }

  async function handleImageSelected(file: File | null) {
    if (!file || !activeConversationId) return;

    await sendMediaMessage("image", file);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function stopRecordingMeters() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recordingAnimationRef.current) {
      window.cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }

    void audioContextRef.current?.close();
    audioContextRef.current = null;
    audioAnalyserRef.current = null;
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  function startVoiceWaveform(stream: MediaStream) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const samples = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 64;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    audioAnalyserRef.current = analyser;

    function draw() {
      analyser.getByteFrequencyData(samples);

      const nextWaveform = Array.from({ length: 24 }, (_, index) => {
        const start = Math.floor((index / 24) * samples.length);
        const end = Math.max(start + 1, Math.floor(((index + 1) / 24) * samples.length));
        const slice = samples.slice(start, end);
        const average =
          slice.reduce((total, value) => total + value, 0) / Math.max(slice.length, 1);

        return Math.min(1, Math.max(0.18, average / 140));
      });

      setVoiceWaveform(nextWaveform);
      recordingAnimationRef.current = window.requestAnimationFrame(draw);
    }

    draw();
  }

  function clearVoicePreview() {
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.pause();
      voicePreviewAudioRef.current.currentTime = 0;
    }

    if (voicePreview?.url) {
      URL.revokeObjectURL(voicePreview.url);
    }

    setVoicePreview(null);
    setVoicePreviewPlaying(false);
  }

  async function sendVoicePreview() {
    if (!voicePreview) return;

    const { blob } = voicePreview;

    clearVoicePreview();
    await sendMediaMessage("voice", blob);
  }

  function stopRecording({ discard = false }: { discard?: boolean } = {}) {
    if (!mediaRecorderRef.current || !recording) return;

    discardRecordingRef.current = discard;
    mediaRecorderRef.current.stop();
  }

  async function toggleVoicePreviewPlayback() {
    const audio = voicePreviewAudioRef.current;

    if (!audio) return;

    if (voicePreviewPlaying) {
      audio.pause();
      setVoicePreviewPlaying(false);
      return;
    }

    await audio.play();
    setVoicePreviewPlaying(true);
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }

    clearVoicePreview();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunksRef.current = [];
    discardRecordingRef.current = false;
    recordingStreamRef.current = stream;
    recordingStartedAtRef.current = Date.now();
    setRecordingSeconds(0);
    setVoiceWaveform(Array.from({ length: 24 }, () => 0.22));

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - (recordingStartedAtRef.current || Date.now())) / 1000),
      );
      const waveform = voiceWaveformRef.current;

      stopRecordingMeters();
      stopRecordingStream();
      setRecording(false);
      mediaRecorderRef.current = null;
      recordingStartedAtRef.current = null;

      if (discardRecordingRef.current) {
        recordedChunksRef.current = [];
        discardRecordingRef.current = false;
        setRecordingSeconds(0);
        setVoiceWaveform(Array.from({ length: 24 }, () => 0.22));
        return;
      }

      const blob = new Blob(recordedChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      recordedChunksRef.current = [];

      if (!blob.size) return;

      setVoicePreview({
        blob,
        durationSeconds,
        url: URL.createObjectURL(blob),
        waveform,
      });
    };

    startVoiceWaveform(stream);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds(
        Math.max(
          0,
          Math.floor((Date.now() - (recordingStartedAtRef.current || Date.now())) / 1000),
        ),
      );
    }, 250);

    recorder.start(250);
    setRecording(true);
  }

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] border-t border-border">
        <aside
          className={cn(
            "flex h-full min-h-0 w-full shrink-0 flex-col border-r border-border bg-background md:w-[24rem]",
            mobileThreadOpen && "hidden md:flex",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Messages
              </p>
              <h1 className="text-lg font-semibold">{viewer.username || viewer.name}</h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="New message"
              onClick={() => setNewMessageOpen(true)}
            >
              <Edit className="size-5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 border-b border-border text-sm font-bold">
            {[
              { count: 0, id: "chats", label: "Chats" },
              { count: requestCount, id: "requests", label: "Requests" },
            ].map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 border-b-2 border-transparent text-muted-foreground",
                  activeInbox === item.id && "border-primary text-foreground",
                )}
                onClick={() => setActiveInbox(item.id as "chats" | "requests")}
                type="button"
              >
                {item.label}
                {item.count ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground">
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="p-4">
            <label className="flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm font-normal text-muted-foreground">
              <Search className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
            {filteredConversations.length ? (
              filteredConversations.map((conversation) => {
                const participant = conversation.otherParticipants[0] || null;
                const active = conversation.id === activeConversationId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/70",
                      active && "bg-muted",
                    )}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <UserAvatar user={participant} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {conversationTitle(conversation)}
                        </span>
                        <span className="shrink-0 text-xs font-normal text-muted-foreground">
                          {formatTime(conversation.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-normal text-muted-foreground">
                        {conversation.muted ? <Bell className="size-3" /> : null}
                        <span className="truncate">{conversation.lastMessagePreview}</span>
                      </span>
                    </span>
                    {conversation.unreadCount ? (
                      <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-sm font-normal text-muted-foreground">
                No conversations yet.
              </div>
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col bg-background",
            !mobileThreadOpen && "hidden md:flex",
            mobileThreadOpen && "flex",
          )}
        >
          {activeConversation ? (
            detailsOpen ? (
              <DetailsPanel
                conversation={activeConversation}
                onBack={() => setDetailsOpen(false)}
                onBlock={(userId) => {
                  startTransition(async () => {
                    const result = await blockUserAction({ blockedUserId: userId });
                    setConversations(result.conversations);
                    setMessages([]);
                    setActiveConversationId(result.conversations[0]?.id || null);
                    setDetailsOpen(false);
                  });
                }}
                onDelete={() => {
                  startTransition(async () => {
                    const result = await deleteConversationAction({
                      conversationId: activeConversation.id,
                    });

                    setConversations(result.conversations);
                    setMessages([]);
                    setActiveConversationId(result.conversations[0]?.id || null);
                    setMobileThreadOpen(false);
                    setDetailsOpen(false);
                  });
                }}
                onMute={(muted) => {
                  startTransition(async () => {
                    const result = await setConversationMutedAction({
                      conversationId: activeConversation.id,
                      muted,
                    });

                    setConversations(result.conversations);
                  });
                }}
                onReport={() => setReportOpen(true)}
              />
            ) : (
              <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      aria-label="Back to inbox"
                      onClick={() => setMobileThreadOpen(false)}
                    >
                      <ArrowLeft className="size-5" />
                    </Button>
                    <UserAvatar className="size-10" user={activeParticipant} />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        {conversationTitle(activeConversation)}
                      </h2>
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {activeParticipantOnline
                          ? "Online"
                          : activeParticipant?.username
                            ? `@${activeParticipant.username}`
                            : "Homzie chat"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Conversation details"
                      onClick={() => setDetailsOpen(true)}
                    >
                      <Info className="size-5" />
                    </Button>
                  </div>
                </header>

                {activeConversation.inbox === "requests" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-3">
                    <p className="text-sm font-normal text-muted-foreground">
                      This message is waiting in Requests.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          startTransition(async () => {
                            const result = await acceptConversationRequestAction({
                              conversationId: activeConversation.id,
                            });

                            setConversations(result.conversations);
                            setMessages(result.messages);
                            setActiveInbox("chats");
                          });
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          startTransition(async () => {
                            const result = await deleteConversationAction({
                              conversationId: activeConversation.id,
                            });

                            setConversations(result.conversations);
                            setMessages([]);
                            setActiveConversationId(null);
                            setMobileThreadOpen(false);
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="relative isolate min-h-0 flex-1 overflow-hidden bg-background before:pointer-events-none before:absolute before:inset-0 before:-z-20 before:bg-[url('/backgrounds/chat-window-background-clipped.png')] before:bg-cover before:bg-center before:bg-no-repeat before:opacity-[0.18] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-background/70 dark:before:opacity-[0.2] dark:before:invert dark:before:brightness-150 dark:after:bg-background/82">
                  <div
                    ref={scrollRef}
                    className="relative z-10 h-full overflow-y-auto overscroll-contain px-4 py-6"
                  >
                    <div className="mx-auto flex max-w-4xl flex-col gap-3">
                    {messages.map((message) => {
                      const mine = message.senderUserId === viewer.id;

                      return (
                        <div
                          key={message.id}
                          className={cn("flex gap-2", mine && "justify-end")}
                        >
                          {!mine ? (
                            <UserAvatar className="mt-auto size-7" user={message.sender} />
                          ) : null}
                          <div
                            className={cn(
                              "max-w-[78%] text-sm md:max-w-[60%]",
                              mine && "text-right",
                            )}
                          >
                            {message.offer ? (
                              <OfferBubble
                                message={message}
                                mine={mine}
                                onRespond={respondToOffer}
                                pending={isPending}
                              />
                            ) : message.attachments.length ? (
                              <AttachmentBubble message={message} mine={mine} />
                            ) : null}
                            {message.body ? (
                              <div
                                className={cn(
                                  "inline-flex rounded-2xl px-4 py-2 text-left font-medium leading-6",
                                  mine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground",
                                )}
                              >
                                {message.body}
                              </div>
                            ) : null}
                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1 text-[11px] font-normal text-muted-foreground",
                                mine && "justify-end",
                              )}
                            >
                              <span>{formatTime(message.createdAt)}</span>
                              {mine ? <DeliveryTicks status={message.status} /> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {someoneTyping ? (
                      <div className="ml-10 text-xs font-normal text-muted-foreground">
                        Typing...
                      </div>
                    ) : null}
                    </div>
                  </div>
                </div>

                <footer className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/95 p-3 backdrop-blur">
                  <div className="relative mx-auto flex max-w-4xl items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) =>
                        handleImageSelected(event.currentTarget.files?.[0] || null)
                      }
                    />
                    <Button
                      ref={emojiButtonRef}
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Open emoji picker"
                      aria-expanded={emojiPickerOpen}
                      onClick={() => setEmojiPickerOpen((open) => !open)}
                    >
                      <Smile className="size-5" />
                    </Button>
                    {emojiPickerOpen ? (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-[calc(100%+0.75rem)] left-0 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/20"
                      >
                        <EmojiPicker
                          autoFocusSearch={false}
                          emojiStyle={EmojiStyle.NATIVE}
                          height={380}
                          lazyLoadEmojis
                          onEmojiClick={(emojiData: EmojiClickData) =>
                            insertEmoji(emojiData.emoji)
                          }
                          previewConfig={{ showPreview: false }}
                          searchPlaceHolder="Search emojis"
                          skinTonePickerLocation={SkinTonePickerLocation.SEARCH}
                          theme={Theme.AUTO}
                          width="100%"
                        />
                      </div>
                    ) : null}
                    {recording ? (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" />
                        <span className="w-10 text-xs font-semibold tabular-nums text-destructive">
                          {formatDuration(recordingSeconds)}
                        </span>
                        <div className="flex h-8 min-w-0 flex-1 items-center gap-1 overflow-hidden">
                          {voiceWaveform.map((level, index) => (
                            <span
                              key={`${index}-${level}`}
                              className="w-1 rounded-full bg-primary/80 transition-[height] duration-100"
                              style={{ height: `${Math.round(8 + level * 24)}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : voicePreview ? (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <audio
                          ref={voicePreviewAudioRef}
                          src={voicePreview.url}
                          className="hidden"
                          onEnded={() => setVoicePreviewPlaying(false)}
                          onPause={() => setVoicePreviewPlaying(false)}
                          onPlay={() => setVoicePreviewPlaying(true)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={voicePreviewPlaying ? "Pause voice note" : "Play voice note"}
                          onClick={toggleVoicePreviewPlayback}
                        >
                          {voicePreviewPlaying ? (
                            <Pause className="size-4" />
                          ) : (
                            <Play className="size-4" />
                          )}
                        </Button>
                        <div className="flex h-8 min-w-0 flex-1 items-center gap-1 overflow-hidden">
                          {voicePreview.waveform.map((level, index) => (
                            <span
                              key={`${index}-${level}`}
                              className="w-1 rounded-full bg-primary/70"
                              style={{ height: `${Math.round(8 + level * 24)}px` }}
                            />
                          ))}
                        </div>
                        <span className="w-10 text-xs font-normal tabular-nums text-muted-foreground">
                          {formatDuration(voicePreview.durationSeconds)}
                        </span>
                      </div>
                    ) : (
                      <input
                        ref={messageInputRef}
                        value={body}
                        onChange={(event) => handleTyping(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendCurrentMessage();
                          }
                        }}
                        placeholder="Message..."
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    )}
                    {recording || voicePreview ? (
                      <>
                        {recording ? (
                          <Button
                            type="button"
                            variant="default"
                            size="icon"
                            aria-label="Stop recording"
                            onClick={() => stopRecording()}
                          >
                            <Mic className="size-5" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={recording ? "Delete recording" : "Delete voice note"}
                          onClick={() =>
                            recording ? stopRecording({ discard: true }) : clearVoicePreview()
                          }
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Voice note"
                          onClick={toggleRecording}
                        >
                          <Mic className="size-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Attach image"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <ImageIcon className="size-5" />
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant={body.trim() || voicePreview ? "default" : "ghost"}
                      size="icon"
                      aria-label={voicePreview ? "Send voice note" : "Send message"}
                      disabled={recording || (!body.trim() && !voicePreview) || isPending}
                      onClick={() => {
                        if (voicePreview) {
                          void sendVoicePreview();
                          return;
                        }

                        sendCurrentMessage();
                      }}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                </footer>
              </div>
            )
          ) : (
            <EmptyMessagesState onNewMessage={() => setNewMessageOpen(true)} />
          )}
        </section>
      </div>

      {newMessageOpen ? (
        <NewMessageDialog
          onClose={() => setNewMessageOpen(false)}
          onStart={(userId) => {
            startTransition(async () => {
              const result = await startConversationAction({ recipientUserId: userId });

              setConversations(result.conversations);
              setMessages(result.messages);
              setActiveConversationId(result.conversationId);
              setMobileThreadOpen(true);
              setNewMessageOpen(false);
            });
          }}
        />
      ) : null}
      {reportOpen && activeConversation ? (
        <ReportDialog
          conversation={activeConversation}
          onClose={() => setReportOpen(false)}
          onSubmit={(reason, details) => {
            startTransition(async () => {
              await reportConversationAction({
                conversationId: activeConversation.id,
                details,
                reason,
                reportedUserId: activeConversation.otherParticipants[0]?.id,
              });
              setReportOpen(false);
            });
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyMessagesState({ onNewMessage }: { onNewMessage: () => void }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-20 place-items-center rounded-full border-2 border-border text-muted-foreground">
          <MessageCircle className="size-9" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">Your messages</h2>
        <p className="mt-2 text-sm font-normal text-muted-foreground">
          Send a message to start a conversation.
        </p>
        <Button className="mt-5" onClick={onNewMessage}>
          Send message
        </Button>
      </div>
    </div>
  );
}

function AttachmentBubble({
  message,
  mine,
}: {
  message: MessageThreadItem;
  mine: boolean;
}) {
  const attachment = message.attachments[0];
  if (!attachment) return null;

  if (attachment.type === "image" && attachment.url) {
    return (
      <div
        className={cn(
          "mb-2 overflow-hidden rounded-lg border border-border bg-card",
          mine && "ml-auto",
        )}
      >
        <Image
          src={attachment.url}
          alt="Message image"
          width={320}
          height={320}
          className="max-h-80 w-full object-cover"
        />
      </div>
    );
  }

  if ((attachment.type === "voice" || attachment.type === "audio") && attachment.url) {
    return (
      <div
        className={cn(
          "mb-2 rounded-2xl border border-border bg-card p-3 text-card-foreground",
          mine && "ml-auto",
        )}
      >
        <audio src={attachment.url} controls className="max-w-full" />
      </div>
    );
  }

  return (
    <Link
      href={attachment.listingId ? `/listings/${attachment.listingId}` : "#"}
      className={cn(
        "mb-2 block overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        mine && "ml-auto",
      )}
    >
      {attachment.previewImageUrl ? (
        <Image
          src={attachment.previewImageUrl}
          alt={attachment.title || "Listing"}
          width={280}
          height={180}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : null}
      <div className="p-3 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Listing
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold">
          {attachment.title || "Shared listing"}
        </p>
      </div>
    </Link>
  );
}

function OfferBubble({
  message,
  mine,
  onRespond,
  pending,
}: {
  message: MessageThreadItem;
  mine: boolean;
  onRespond?: (offerId: string, status: "accepted" | "declined") => void;
  pending?: boolean;
}) {
  const offer = message.offer;
  if (!offer) return null;

  const listing = message.attachments[0];
  const canRespond = !mine && offer.status === "pending";
  const statusClassName =
    offer.status === "accepted"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : offer.status === "declined"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";

  return (
    <div
      className={cn(
        "mb-2 overflow-hidden rounded-lg border border-border bg-card text-left text-card-foreground shadow-sm",
        mine && "ml-auto",
      )}
    >
      {listing?.previewImageUrl ? (
        <Image
          src={listing.previewImageUrl}
          alt={listing.title || "Listing offer"}
          width={320}
          height={180}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : null}
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Property offer
        </p>
        <p className="mt-1 text-lg font-semibold">
          {offerLabel(offer.amountCents, offer.currency)}
        </p>
        {listing?.title ? (
          <p className="mt-1 line-clamp-2 text-sm font-normal text-muted-foreground">
            {listing.title}
          </p>
        ) : null}
        <span
          className={cn(
            "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
            statusClassName,
          )}
        >
          {offer.status}
        </span>
        {canRespond ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              className="h-10 rounded-md border-transparent bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              disabled={pending}
              onClick={() => onRespond?.(offer.id, "accepted")}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-md text-xs font-semibold text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => onRespond?.(offer.id, "declined")}
            >
              Decline
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailsPanel({
  conversation,
  onBack,
  onBlock,
  onDelete,
  onMute,
  onReport,
}: {
  conversation: ConversationSummary;
  onBack: () => void;
  onBlock: (userId: string) => void;
  onDelete: () => void;
  onMute: (muted: boolean) => void;
  onReport: () => void;
}) {
  const participant = conversation.otherParticipants[0] || null;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-16 items-center gap-3 border-b border-border px-4">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold">Details</h2>
      </header>
      <div className="border-b border-border p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 text-left"
          onClick={() => onMute(!conversation.muted)}
        >
          <span className="flex items-center gap-3 text-sm font-bold">
            <Bell className="size-5" />
            Mute messages
          </span>
          <span
            className={cn(
              "relative h-6 w-11 rounded-full bg-muted transition-colors",
              conversation.muted && "bg-primary",
            )}
          >
            <span
              className={cn(
                "absolute left-1 top-1 size-4 rounded-full bg-background transition-transform",
                conversation.muted && "translate-x-5",
              )}
            />
          </span>
        </button>
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm font-semibold">Members</p>
        {participant ? (
          <div className="mt-4 flex items-center gap-3">
            <UserAvatar user={participant} />
            <div>
              <p className="text-sm font-semibold">{participant.name}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {participant.username ? `@${participant.username}` : "Homzie user"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-t border-border p-4">
        {participant ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 py-3 text-left text-sm font-bold"
            onClick={() => onBlock(participant.id)}
          >
            <CircleOff className="size-5" />
            Block
          </button>
        ) : null}
        <button
          type="button"
          className="flex w-full items-center gap-3 py-3 text-left text-sm font-bold text-destructive"
          onClick={onReport}
        >
          <CircleAlert className="size-5" />
          Report
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 py-3 text-left text-sm font-bold text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-5" />
          Delete chat
        </button>
      </div>
    </div>
  );
}

function NewMessageDialog({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const cleanQuery = query.trim();

      if (cleanQuery.length < 2) {
        setResults([]);
        return;
      }

      const response = await fetch(`/api/users/search?q=${encodeURIComponent(cleanQuery)}`);
      const payload = response.ok ? await response.json() : { users: [] };

      setResults(Array.isArray(payload.users) ? payload.users : []);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(42rem,90vh)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <span />
          <h2 className="text-base font-semibold">New message</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </header>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">To:</span>
          <input
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-4 py-3 text-sm font-semibold">Suggested</p>
          {results.length ? (
            results.map((user) => (
              <button
                key={user.username}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted",
                  selectedUserId === user.id && "bg-muted",
                )}
                onClick={() => setSelectedUserId(user.id || null)}
              >
                <UserAvatar user={user} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{user.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    @{user.username}
                  </span>
                </span>
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border border-border",
                    selectedUserId === user.id && "border-primary bg-primary text-white",
                  )}
                >
                  {selectedUserId === user.id ? <Check className="size-4" /> : null}
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm font-normal text-muted-foreground">
              Search for a user or agent to start chatting.
            </div>
          )}
        </div>
        <div className="border-t border-border p-4">
          <Button
            className="w-full"
            disabled={!selectedUserId}
            onClick={() => selectedUserId && onStart(selectedUserId)}
          >
            Chat
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportDialog({
  conversation,
  onClose,
  onSubmit,
}: {
  conversation: ConversationSummary;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
}) {
  const [reason, setReason] = useState("Spam or scam");
  const [details, setDetails] = useState("");
  const participant = conversation.otherParticipants[0];

  return (
    <div className="fixed inset-0 z-[140] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Report conversation</h2>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Tell us what happened with {participant?.name || "this chat"}.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        <label className="mt-5 block text-sm font-semibold">
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
          >
            <option>Spam or scam</option>
            <option>Harassment or bullying</option>
            <option>Hate speech</option>
            <option>Unsafe property or payment request</option>
            <option>Other</option>
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Details
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={4}
            placeholder="Optional context"
            className="mt-2 w-full resize-none rounded-md border border-border bg-background p-3 text-sm font-semibold outline-none focus:border-primary"
          />
        </label>
        <Button
          className="mt-5 w-full"
          onClick={() => onSubmit(reason, details.trim() || undefined)}
        >
          Submit report
        </Button>
      </div>
    </div>
  );
}
