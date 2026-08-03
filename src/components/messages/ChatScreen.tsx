import { ArrowLeft, MoreVertical, Paperclip, Send, Star } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { MessageItem } from '../../data/messages';
import { useChatStore } from '../../stores/chatStore';
import { formatPresenceLabel } from '../../utils/formatRelativeTime';
import { MessageBubble } from './MessageBubble';
import { PendingMediaBubble } from './PendingMediaBubble';

interface ChatScreenProps {
  contact: MessageItem;
  userId: string;
  onBack: () => void;
}

interface LocalAttachmentDraft {
  id: string;
  file: File;
  previewUrl?: string;
}

function ContactAvatar({ contact }: { contact: MessageItem }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${contact.avatarBg} ${contact.avatarText}`}
    >
      {contact.initials}
    </div>
  );
}

export function ChatScreen({ contact, userId, onBack }: ChatScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const [selectedAttachments, setSelectedAttachments] = useState<LocalAttachmentDraft[]>([]);

  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    draft,
    error,
    businessPresence,
    pendingUploads,
    openChat,
    closeChat,
    loadMoreMessages,
    sendChatMessage,
    sendChatMedia,
    setDraft,
  } = useChatStore();

  useEffect(() => {
    void openChat(contact, userId);
    return () => closeChat();
    // Only re-open when chat or user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.chatId, userId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || loadingMore) return;

    if (isPrependingRef.current) {
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      isPrependingRef.current = false;
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, loading, loadingMore, pendingUploads]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          prevScrollHeightRef.current = container.scrollHeight;
          isPrependingRef.current = true;
          void loadMoreMessages();
        }
      },
      { root: container, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMoreMessages]);

  useEffect(
    () => () => {
      selectedAttachments.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
    },
    [selectedAttachments],
  );

  const handleSend = () => {
    void sendChatMessage(draft);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const drafts: LocalAttachmentDraft[] = files.map((file, index) => {
      const isVisual = file.type.startsWith('image/') || file.type.startsWith('video/');
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        previewUrl: isVisual ? URL.createObjectURL(file) : undefined,
      };
    });

    setSelectedAttachments((prev) => [...prev, ...drafts]);
  };

  const removeSelectedAttachment = (id: string) => {
    setSelectedAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearSelectedAttachments = () => {
    setSelectedAttachments((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  };

  const handleSendSelectedAttachments = async () => {
    if (selectedAttachments.length === 0 || sending || loading) return;

    const attachmentsToSend = selectedAttachments;
    clearSelectedAttachments();

    for (const attachment of attachmentsToSend) {
      await sendChatMedia(attachment.file);
    }
  };

  const hasFeedContent = messages.length > 0 || pendingUploads.length > 0;

  const presenceLabel = formatPresenceLabel(businessPresence);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#efeae2] lg:left-[240px] xl:left-[260px]">
      <header className="shrink-0 border-b border-[#e9edef] bg-[#f0f2f5]">
        <div className="mx-auto flex h-[60px] w-full max-w-[480px] items-center gap-3 px-3 lg:max-w-3xl lg:px-6">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/5"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>

          <ContactAvatar contact={contact} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-[16px] font-semibold text-[#111b21]">
                {contact.name}
              </p>
              {!contact.isAdmin && (
                <>
                  <Star
                    className="h-3 w-3 shrink-0 text-brand"
                    fill="#e87a4d"
                    strokeWidth={0}
                  />
                  <span className="text-[12px] font-semibold text-[#111b21]">
                    {contact.rating}
                  </span>
                </>
              )}
            </div>
            <p
              className={`truncate text-[12px] ${
                businessPresence.online ? 'text-emerald-600' : 'text-[#667781]'
              }`}
            >
              {presenceLabel}
            </p>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/5"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`mx-auto min-h-0 w-full max-w-[480px] flex-1 bg-[#efeae2] px-3 py-4 lg:max-w-3xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          hasFeedContent || loadingMore ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.02) 0, transparent 50%), radial-gradient(circle at 80% 0%, rgba(0,0,0,0.02) 0, transparent 40%)',
        }}
      >
        <div ref={topSentinelRef} className="h-1" />

        {loadingMore && (
          <p className="mb-3 text-center text-[11px] text-[#667781]">
            Loading older messages...
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-14 animate-pulse rounded-lg bg-white/70 ${
                  i % 2 === 0 ? 'ml-auto w-[70%]' : 'w-[70%]'
                }`}
              />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-lg bg-white/80 p-4 text-center text-sm text-red-600">
            {error}
          </p>
        ) : messages.length === 0 && pendingUploads.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="rounded-lg bg-white/80 px-4 py-2 text-[13px] text-[#667781]">
              Say hello to {contact.name}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderType === 'user'}
              />
            ))}
            {pendingUploads.map((upload) => (
              <PendingMediaBubble key={upload.id} upload={upload} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#e9edef] bg-[#f0f2f5] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 lg:max-w-3xl">
          {selectedAttachments.length > 0 && (
            <div className="rounded-lg border border-[#d1d7db] bg-white p-2">
              <div className="mb-2 flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
                {selectedAttachments.map((attachment) => {
                  const isImage = attachment.file.type.startsWith('image/');
                  const isVideo = attachment.file.type.startsWith('video/');
                  const fileTypeLabel = isImage
                    ? 'Image'
                    : isVideo
                      ? 'Video'
                      : attachment.file.type || 'Document';

                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-md border border-[#e9edef] p-2"
                    >
                      {attachment.previewUrl && isImage ? (
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.file.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : attachment.previewUrl && isVideo ? (
                        <video
                          src={attachment.previewUrl}
                          className="h-12 w-12 rounded object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-[#f0f2f5] text-[10px] text-[#667781]">
                          FILE
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#111b21]">
                          {attachment.file.name}
                        </p>
                        <p className="truncate text-xs text-[#667781]">{fileTypeLabel}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSelectedAttachment(attachment.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={clearSelectedAttachments}
                  className="rounded-md border border-[#d1d7db] px-3 py-1.5 text-sm text-[#54656f] hover:bg-[#f5f6f6]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendSelectedAttachments()}
                  disabled={sending || loading}
                  className="rounded-md bg-[#00a884] px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-[#008f72] disabled:bg-[#8696a0]"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleAttachmentClick}
            disabled={sending || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/5 disabled:opacity-60"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" strokeWidth={2} />
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message"
            disabled={sending || loading}
            className="flex-1 rounded-lg border border-[#e9edef] bg-white px-4 py-2.5 text-[15px] text-[#111b21] placeholder:text-[#8696a0] outline-none focus:border-[#00a884]/40 focus:ring-2 focus:ring-[#00a884]/15 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white transition-colors disabled:bg-[#8696a0] enabled:hover:bg-[#008f72]"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" strokeWidth={2} />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
