import type { BusinessProfile } from '../services/businessService';
import type { MessageItem } from '../data/messages';
import {
  getBusinessAvatarStyle,
  getBusinessInitials,
} from './businessDisplay';

const TIME_LABELS = ['2m ago', '2h ago', 'Yesterday', '3d ago'];
const STATUS_LABELS = ['Unread', 'Replied', 'Active now', 'Archived'];
const PREVIEW_TEMPLATES = [
  "Hi, I've just sent through the updated quote for your fence installation. Let me know if you have any questions.",
  'Thanks for the update. We can start the fence job next Monday if that works for you.',
  'We reviewed your job post and would love to provide a competitive quote.',
  'Your quote is ready. Let us know if you need any changes.',
];

export function buildChatId(userId: string, businessId: string): string {
  return `${userId}_${businessId}`;
}

export function businessToMessageItem(
  business: BusinessProfile,
  userId: string,
  index = 0,
): MessageItem {
  const initials = getBusinessInitials(business.businessName);
  const { avatarBg, avatarText } = getBusinessAvatarStyle(business.businessName);
  const slot = index % PREVIEW_TEMPLATES.length;

  return {
    id: business.id,
    chatId: buildChatId(userId, business.id),
    businessId: business.id,
    name: business.businessName,
    rating: business.rating || 0,
    time: TIME_LABELS[slot],
    preview: PREVIEW_TEMPLATES[slot],
    status: STATUS_LABELS[slot],
    unread: index === 0,
    initials,
    avatarBg,
    avatarText,
  };
}
