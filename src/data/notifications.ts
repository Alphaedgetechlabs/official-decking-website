export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'quote' | 'message' | 'job' | 'system';
}

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'New quote received',
    body: 'SA Local Deck Co. sent a quote of $4,850 for your Fence Installation job.',
    time: '2m ago',
    read: false,
    type: 'quote',
  },
  {
    id: '2',
    title: 'New message',
    body: 'SA TimberLine Decking replied to your fence installation enquiry.',
    time: '2h ago',
    read: false,
    type: 'message',
  },
  {
    id: '3',
    title: 'Job status updated',
    body: 'Your Fence Installation job has been marked as Accepted.',
    time: 'Yesterday',
    read: true,
    type: 'job',
  },
  {
    id: '4',
    title: 'Quote archived',
    body: 'SA SecureBound Decking archived their quote. You can request a revision anytime.',
    time: 'Oct 14',
    read: true,
    type: 'quote',
  },
  {
    id: '5',
    title: 'Welcome to QuoteMyFence',
    body: 'Your job post is live. Matched contractors can now send quotes and messages.',
    time: 'Oct 12',
    read: true,
    type: 'system',
  },
  {
    id: '6',
    title: 'Review reminder',
    body: 'Your fence job is complete. Leave a review to help other homeowners.',
    time: 'Oct 10',
    read: true,
    type: 'system',
  },
];
