import { ArrowLeft, Headphones, Paperclip, Send } from 'lucide-react';
import { useEffect, useRef, type ChangeEvent } from 'react';
import { PendingMediaBubble } from '../messages/PendingMediaBubble';
import { useAdminSupportChatStore } from '../../stores/adminSupportChatStore';
import { formatAdminSupportPresenceLabel } from '../../utils/formatRelativeTime';
import { AdminSupportMessageBubble } from './AdminSupportMessageBubble';

interface AdminSupportChatScreenProps {
  /** Phone-based Firestore user doc ID — must match admin dashboard paths. */
  userDocId: string;
  onBack: () => void;
}

export function AdminSupportChatScreen({
  userDocId,
  onBack,
}: AdminSupportChatScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    draft,
    error,
    adminPresence,
    pendingUploads,
    openChat,
    closeChat,
    loadMoreMessages,
    sendMessage,
    sendMedia,
    onAdminMessageVisible,
    setDraft,
  } = useAdminSupportChatStore();

  useEffect(() => {
    void openChat(userDocId);
    return () => closeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDocId]);

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

  const handleSend = () => {
    void sendMessage(draft);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void sendMedia(file);
  };

  const hasFeedContent = messages.length > 0 || pendingUploads.length > 0;
  const presenceLabel = formatAdminSupportPresenceLabel(adminPresence);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#efeae2] lg:left-[240px] xl:left-[260px]">
      <header className="shrink-0 border-b border-[#e9edef] bg-[#f0f2f5]">
        <div className="mx-auto flex h-[60px] w-full max-w-[480px] items-center gap-3 px-3 lg:max-w-3xl lg:px-6">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/5"
            aria-label="Back to help"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light">
            <Headphones className="h-5 w-5 text-brand" strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-[#111b21]">
              QuoteMyFence Support
            </p>
            <p
              className={`truncate text-[12px] ${
                adminPresence.isOnline ? 'text-emerald-600' : 'text-[#667781]'
              }`}
            >
              {presenceLabel}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`mx-auto min-h-0 w-full max-w-[480px] flex-1 bg-[#efeae2] px-3 py-4 lg:max-w-3xl ${
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
              Send a message to our support team
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <AdminSupportMessageBubble
                key={message.id}
                message={message}
                onAdminMessageVisible={onAdminMessageVisible}
              />
            ))}
            {pendingUploads.map((upload) => (
              <PendingMediaBubble key={upload.id} upload={upload} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#e9edef] bg-[#f0f2f5] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[480px] items-end gap-2 lg:max-w-3xl">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
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
  );
}
