export interface ChatMessage {
  id: string;
  sender: 'user' | 'contact';
  text: string;
  time: string;
}

export interface ChatThread {
  contactId: string;
  messages: ChatMessage[];
}

export const CHAT_THREADS: Record<string, ChatThread> = {
  'sa-local-deck': {
    contactId: 'sa-local-deck',
    messages: [
      {
        id: '1',
        sender: 'contact',
        text: 'Hi! Thanks for posting your fence installation job on QuoteMyFence.',
        time: '10:12 AM',
      },
      {
        id: '2',
        sender: 'contact',
        text: "We've reviewed your property details and photos. I can offer a competitive rate for Colorbond fencing.",
        time: '10:14 AM',
      },
      {
        id: '3',
        sender: 'user',
        text: 'That sounds great. Can you send through the full quote?',
        time: '10:22 AM',
      },
      {
        id: '4',
        sender: 'contact',
        text: "Hi, I've just sent through the updated quote for your fence installation. Let me know if you have any questions.",
        time: '10:45 AM',
      },
    ],
  },
  'sa-timberline': {
    contactId: 'sa-timberline',
    messages: [
      {
        id: '1',
        sender: 'contact',
        text: 'Hello! SA TimberLine Decking here. We specialise in premium timber and composite fencing.',
        time: 'Yesterday 2:10 PM',
      },
      {
        id: '2',
        sender: 'user',
        text: 'What timeline are you looking at for a standard side fence?',
        time: 'Yesterday 3:05 PM',
      },
      {
        id: '3',
        sender: 'contact',
        text: 'Thanks for the update. We can start the fence job next Monday if that works for you.',
        time: 'Yesterday 4:30 PM',
      },
    ],
  },
  'sa-securebound': {
    contactId: 'sa-securebound',
    messages: [
      {
        id: '1',
        sender: 'contact',
        text: 'Hi there — SA SecureBound Decking. We quoted your fence job last week.',
        time: 'Oct 14 9:00 AM',
      },
      {
        id: '2',
        sender: 'user',
        text: 'I went with another contractor for now. Can we keep the quote on file?',
        time: 'Oct 14 11:20 AM',
      },
      {
        id: '3',
        sender: 'contact',
        text: 'Your quote has been archived. Let us know if you need it reopened or revised.',
        time: 'Oct 14 2:15 PM',
      },
    ],
  },
  admin: {
    contactId: 'admin',
    messages: [
      {
        id: '1',
        sender: 'contact',
        text: 'Welcome to QuoteMyFence! Your job post has been matched with local contractors.',
        time: 'Oct 10 8:00 AM',
      },
      {
        id: '2',
        sender: 'contact',
        text: 'Your fence installation job has been marked as accepted. Contractors can now message you directly.',
        time: 'Oct 10 9:30 AM',
      },
      {
        id: '3',
        sender: 'contact',
        text: 'Job marked as completed. Please leave a review when you have a moment.',
        time: 'Oct 10 4:00 PM',
      },
    ],
  },
};

export function getChatThread(contactId: string): ChatThread | undefined {
  return CHAT_THREADS[contactId];
}
