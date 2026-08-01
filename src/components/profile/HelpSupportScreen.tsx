import {
  ChevronRight,
  CircleHelp,
  Info,
  MessageCircle,
  PencilLine,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SubPageHeader } from './SubPageHeader';

interface ArticleItem {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Wallet;
  answer: string;
}

const ARTICLES: ArticleItem[] = [
  {
    id: 'payments',
    title: 'How payments work',
    subtitle: 'Security and processing times',
    icon: Wallet,
    answer:
      'Payments are handled securely between you and your tradie after you accept a quote. We do not store your card details. Processing times depend on your chosen payment method.',
  },
  {
    id: 'guarantee',
    title: 'Verified Tradie Guarantee',
    subtitle: 'Our 100% satisfaction promise',
    icon: ShieldCheck,
    answer:
      'Every tradie on QuoteMyFence is verified before they can quote on jobs. If something goes wrong, our support team will help resolve the issue.',
  },
  {
    id: 'edit-quote',
    title: 'Editing your quote',
    subtitle: 'Modify details after submission',
    icon: PencilLine,
    answer:
      'Need to update your job details, photos, or timeline? Contact our support team via chat or email and we will help you make changes.',
  },
];

const FAQ_ANSWERS = [
  {
    question: 'How do I get quotes from contractors?',
    answer:
      'Submit a free quote request through the wizard. Once your job is posted, matched local contractors can send quotes and message you directly.',
  },
  {
    question: 'How do I contact a contractor?',
    answer:
      'Go to Messages or tap the message icon on a job card. You can chat with any matched contractor from your job post.',
  },
  {
    question: 'Is QuoteMyFence free for homeowners?',
    answer:
      'Yes. Getting quotes and connecting with contractors is completely free for homeowners.',
  },
];

function ArticleRow({
  item,
  onSelect,
}: {
  item: ArticleItem;
  onSelect: (item: ArticleItem) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-4 py-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:border-brand/25"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light">
        <Icon className="h-[18px] w-[18px] text-brand" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold leading-tight text-heading">
          {item.title}
        </p>
        <p className="mt-0.5 text-[12px] text-body">{item.subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-body" strokeWidth={2} />
    </button>
  );
}

export function HelpSupportScreen({
  onBack,
  onOpenSupportChat,
}: {
  onBack: () => void;
  onOpenSupportChat?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showFaqs, setShowFaqs] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(
    null,
  );

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return ARTICLES;
    return ARTICLES.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <div className="min-h-svh bg-surface">
      <SubPageHeader title="Help & Support" onBack={onBack} />

      <div className="mx-auto w-full max-w-[480px] lg:max-w-3xl">
        <main className="px-5 pb-24 pt-6 lg:px-8 lg:pt-8">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-heading lg:text-[30px]">
            How can we help?
          </h1>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-body" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help articles..."
              className="h-11 w-full rounded-xl border border-border bg-white pr-4 pl-10 text-[13px] text-heading placeholder:text-body outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onOpenSupportChat}
              className="flex min-h-[120px] flex-col justify-between rounded-2xl bg-brand p-4 text-left shadow-[0_4px_14px_rgba(232,122,77,0.28)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <MessageCircle
                className="h-6 w-6 text-white"
                strokeWidth={1.75}
                fill="white"
              />
              <div>
                <p className="text-[15px] font-bold text-white">Chat with Us</p>
                <p className="mt-1 text-[12px] text-white/85">Reply in 5 min</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowFaqs((v) => !v)}
              className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-border bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:border-brand/25"
            >
              <CircleHelp className="h-6 w-6 text-brand" strokeWidth={1.75} />
              <div>
                <p className="text-[15px] font-bold text-heading">Browse FAQs</p>
                <p className="mt-1 text-[12px] text-body">Quick answers</p>
              </div>
            </button>
          </div>

          <section className="mt-7">
            <h2 className="mb-3 text-[15px] font-bold text-heading">Articles</h2>
            <div className="space-y-2.5">
              {filteredArticles.map((item) => (
                <ArticleRow
                  key={item.id}
                  item={item}
                  onSelect={setSelectedArticle}
                />
              ))}
              {filteredArticles.length === 0 && (
                <p className="rounded-2xl border border-border bg-white px-4 py-6 text-center text-sm text-body">
                  No articles match your search.
                </p>
              )}
            </div>
          </section>

          {selectedArticle && (
            <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[14px] font-bold text-heading">
                {selectedArticle.title}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-body">
                {selectedArticle.answer}
              </p>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="mt-3 text-[12px] font-semibold text-brand"
              >
                Close
              </button>
            </div>
          )}

          {showFaqs && (
            <section className="mt-5 space-y-2.5">
              {FAQ_ANSWERS.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-border bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <p className="text-[13px] font-bold text-heading">
                    {faq.question}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-body">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </section>
          )}

          <div className="mt-6 flex gap-3 rounded-2xl bg-brand-light px-4 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15">
              <Info className="h-4 w-4 text-brand" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-heading">
                System Status: All systems go
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-body">
                We&apos;re currently processing quotes and messages at normal
                speeds. No delays reported.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
