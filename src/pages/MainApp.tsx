import { useEffect, useMemo, useState } from 'react';
import { AddJobFab } from '../components/addJob/AddJobFab';
import { AddJobSheet } from '../components/addJob/AddJobSheet';
import { BottomNav } from '../components/home/BottomNav';
import { HomeGreeting, HomeTopBar } from '../components/home/HomeHeader';
import { JobPostsList } from '../components/home/JobPostCard';
import { JobPostsSection } from '../components/home/JobPostsSection';
import { Sidebar } from '../components/home/Sidebar';
import { DesktopTopBar } from '../components/layout/DesktopTopBar';
import { BusinessMessagesList } from '../components/messages/BusinessMessagesList';
import { ChatScreen } from '../components/messages/ChatScreen';
import { AdminSupportChatScreen } from '../components/support/AdminSupportChatScreen';
import {
  MessagesHeader,
  MessagesPageTitle,
} from '../components/messages/MessagesContent';
import { HelpSupportScreen } from '../components/profile/HelpSupportScreen';
import { MyJobsScreen } from '../components/profile/MyJobsScreen';
import { NotificationsScreen } from '../components/profile/NotificationsScreen';
import {
  ProfileBanner,
  ProfileMenu,
  ProfilePageHeader,
  ProfilePageTitle,
} from '../components/profile/ProfileContent';
import type { MessageItem } from '../data/messages';
import { useConversationInbox } from '../hooks/useConversationInbox';
import {
  ADMIN_SUPPORT_CHAT_ID,
  useAdminSupportInbox,
} from '../hooks/useAdminSupportInbox';
import { useAuthUid } from '../hooks/useAuthUid';
import { useDashboardUser } from '../hooks/useUserData';
import { useMatchedBusinesses } from '../hooks/useMatchedBusinesses';
import { useUserAcceptedBusinesses } from '../hooks/useUserAcceptedBusinesses';
import { useUserJobs } from '../hooks/useUserJobs';
import { fetchBusinessById } from '../services/businessService';
import { logoutUser } from '../services/authService';
import {
  initUserPresence,
  teardownUserPresence,
} from '../services/rtdb/presenceService';
import {
  initAdminSupportUserPresence,
  teardownAdminSupportUserPresence,
} from '../services/rtdb/adminSupportPresenceService';
import { getFirstName } from '../types/user';
import { businessToMessageItem } from '../utils/businessToMessage';
import type { NavTab } from '../types/nav';
import type { ProfileScreen } from '../types/profile';
import { useNotificationStore } from '../stores/notificationStore';
import { clearSession, getStoredPhoneId } from '../utils/session';
import { resolveAdminSupportUserId } from '../utils/adminSupportUserId';
import { useAuthFlowStore } from '../stores/authFlowStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { prefetchDashboardForUser, ensureInstantBusinesses } from '../lib/dashboardBusinesses';

/** Flip to true to re-enable the home-screen add-job FAB. */
const ENABLE_ADD_JOB = false;

interface MainAppProps {
  onLogout: () => void;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="loading-dot h-2.5 w-2.5 rounded-full bg-brand-muted"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function MainApp({ onLogout }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [profileScreen, setProfileScreen] = useState<ProfileScreen>('main');
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [businessesRefreshKey, setBusinessesRefreshKey] = useState(0);
  const [resolvedContact, setResolvedContact] = useState<MessageItem | null>(
    null,
  );
  const cachedUser = useDashboardStore((s) => s.user);
  const { authUid, authReady } = useAuthUid();
  const { user, loading, error } = useDashboardUser();
  const displayUser = user ?? cachedUser;

  const userId = authUid ?? '';
  const userDocId = resolveAdminSupportUserId(displayUser?.phone, getStoredPhoneId());

  const {
    jobs: userJobs,
    loading: userJobsLoading,
    error: userJobsError,
  } = useUserJobs(authUid, displayUser, userDocId ?? '');

  // One card per posted job (tied to jobId) — not latest-per-category.
  const homeJobs = userJobs;

  const businesses = useDashboardStore((s) => s.businesses);
  const {
    loading: businessesLoading,
    error: businessesError,
  } = useMatchedBusinesses(userJobs, displayUser, businessesRefreshKey);
  // Matched list still feeds Home / add-job; messages use accepted_jobs only.
  const showBusinessesLoading = businessesLoading && businesses.length === 0;

  const {
    businesses: acceptedChatBusinesses,
    loading: acceptedChatLoading,
  } = useUserAcceptedBusinesses(authUid);

  const unreadCount = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.read).length,
  );
  const initNotifications = useNotificationStore((s) => s.init);
  const teardownNotifications = useNotificationStore((s) => s.teardown);

  const acceptedChatBusinessIdsKey = useMemo(
    () => acceptedChatBusinesses.map((b) => b.id).join(','),
    [acceptedChatBusinesses],
  );

  const {
    messages: inboxMessages,
    loading: inboxLoading,
    error: inboxError,
  } = useConversationInbox(userId, userDocId, acceptedChatBusinesses);

  const { messageItem: supportMessageItem } = useAdminSupportInbox(userDocId);

  const messagesWithSupport = useMemo(() => {
    if (!supportMessageItem) return inboxMessages;

    const withoutSupport = inboxMessages.filter(
      (m) => m.businessId !== ADMIN_SUPPORT_CHAT_ID,
    );

    return [supportMessageItem, ...withoutSupport];
  }, [inboxMessages, supportMessageItem]);

  const businessMessages = useMemo(
    () =>
      acceptedChatBusinesses.map((business, index) =>
        businessToMessageItem(business, userId, index),
      ),
    [acceptedChatBusinesses, userId],
  );

  const activeContact = useMemo(() => {
    if (!activeChatId) return null;
    const fromInbox = inboxMessages.find((m) => m.businessId === activeChatId);
    if (fromInbox) return fromInbox;
    const fromList = businessMessages.find((m) => m.businessId === activeChatId);
    if (fromList) return fromList;
    return resolvedContact?.businessId === activeChatId ? resolvedContact : null;
  }, [activeChatId, inboxMessages, businessMessages, resolvedContact]);

  useEffect(() => {
    if (!displayUser) return;
    ensureInstantBusinesses();
    void prefetchDashboardForUser(displayUser);
  }, [displayUser?.phone]);

  useEffect(() => {
    if (!activeChatId || !userId) {
      setResolvedContact(null);
      return;
    }

    const existsInInbox = inboxMessages.some((m) => m.businessId === activeChatId);
    const existsInHome = businessMessages.some((m) => m.businessId === activeChatId);
    if (existsInInbox || existsInHome) {
      setResolvedContact(null);
      return;
    }

    let cancelled = false;

    void fetchBusinessById(activeChatId).then((business) => {
      if (cancelled || !business) return;
      setResolvedContact(businessToMessageItem(business, userId, 0));
    });

    return () => {
      cancelled = true;
    };
  }, [activeChatId, inboxMessages, businessMessages, userId]);

  useEffect(() => {
    if (!authReady || !userId) return;
    initUserPresence(userId);
    return () => teardownUserPresence();
  }, [authReady, userId]);

  useEffect(() => {
    if (!authReady || !userDocId) return;
    initAdminSupportUserPresence(userDocId);
    return () => teardownAdminSupportUserPresence();
  }, [authReady, userDocId]);

  useEffect(() => {
    if (!authReady || !userId) return;
    initNotifications(userId, userDocId, acceptedChatBusinesses);
    return () => teardownNotifications();
    // acceptedChatBusinessIdsKey tracks membership; array read on key change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid array-identity thrash
  }, [
    authReady,
    userId,
    userDocId,
    acceptedChatBusinessIdsKey,
    initNotifications,
    teardownNotifications,
  ]);

  const clearActiveChat = () => {
    setActiveChatId(null);
    setResolvedContact(null);
  };

  const openNotifications = () => {
    setActiveTab('profile');
    setProfileScreen('notifications');
    clearActiveChat();
  };

  useEffect(() => {
    if (activeTab !== 'messages') {
      setActiveChatId(null);
      setResolvedContact(null);
    }
  }, [activeTab]);

  const handleLogout = () => {
    teardownNotifications();
    teardownUserPresence();
    teardownAdminSupportUserPresence();
    useAuthFlowStore.getState().clear();
    useDashboardStore.getState().clear();
    clearSession();
    onLogout();
    void logoutUser().catch((err) => {
      console.error('Logout error:', err);
    });
  };

  const handleTabChange = (tab: NavTab) => {
    clearActiveChat();
    setSupportChatOpen(false);
    setActiveTab(tab);
    if (tab !== 'profile') {
      setProfileScreen('main');
    }
  };

  const openChat = (businessId: string) => {
    if (businessId === ADMIN_SUPPORT_CHAT_ID) {
      openSupportChat();
      return;
    }
    setActiveTab('messages');
    setProfileScreen('main');
    setActiveChatId(businessId);
  };

  const openSupportChat = () => {
    setSupportChatOpen(true);
    setActiveChatId(null);
    setResolvedContact(null);
  };

  if ((!authReady && !cachedUser) || (loading && !displayUser)) {
    return <LoadingScreen />;
  }

  if (error || !displayUser) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-6">
        <p className="text-sm text-body">
          {error ?? 'Unable to load your profile'}
        </p>
      </div>
    );
  }

  const firstName = getFirstName(displayUser.fullName);
  const avatarUrl = displayUser.photoUrls?.[0];
  const isProfileSubScreen = activeTab === 'profile' && profileScreen !== 'main';
  const showShell = !activeChatId && !supportChatOpen && !isProfileSubScreen;

  return (
    <div className="min-h-svh bg-surface">
      <Sidebar user={displayUser} active={activeTab} onChange={handleTabChange} />

      <div className="flex min-h-svh flex-col lg:pl-[240px] xl:pl-[260px]">
        {showShell && (
          <DesktopTopBar
            firstName={firstName}
            avatarUrl={avatarUrl}
            unreadCount={unreadCount}
            onNotificationsClick={openNotifications}
          />
        )}

        {activeTab === 'home' && (
          <>
            <HomeTopBar
              unreadCount={unreadCount}
              onNotificationsClick={openNotifications}
            />
            <div className="mx-auto w-full max-w-[480px] flex-1 lg:max-w-4xl lg:px-8">
              <main className="px-5 pt-6 pb-24 lg:px-0 lg:pt-8 lg:pb-10">
                <HomeGreeting firstName={firstName} />
                <JobPostsSection>
                  <JobPostsList
                    jobs={homeJobs}
                    loading={userJobsLoading}
                    error={userJobsError}
                    businesses={businesses}
                    businessesLoading={showBusinessesLoading}
                    businessesError={businessesError}
                    onMessageContractor={openChat}
                  />
                </JobPostsSection>
              </main>
            </div>
          </>
        )}

        {activeTab === 'messages' && !activeChatId && (
          <>
            <MessagesHeader />
            <div className="mx-auto w-full max-w-[480px] flex-1 lg:max-w-3xl lg:px-8">
              <main className="px-5 pt-5 pb-24 lg:px-0 lg:pt-8 lg:pb-10">
                <MessagesPageTitle />
                <BusinessMessagesList
                  messages={messagesWithSupport}
                  loading={acceptedChatLoading || inboxLoading}
                  error={inboxError}
                  onOpenChat={openChat}
                />
              </main>
            </div>
          </>
        )}

        {activeTab === 'profile' && profileScreen === 'main' && (
          <>
            <ProfilePageHeader />
            <div className="mx-auto w-full max-w-[480px] flex-1 lg:max-w-3xl lg:px-8">
              <main className="px-5 pt-2 pb-24 lg:px-0 lg:pt-8 lg:pb-10">
                <ProfilePageTitle />
                <ProfileBanner user={displayUser} />
                <div className="mt-6">
                  <ProfileMenu
                    onLogout={handleLogout}
                    onMyJobs={() => setProfileScreen('my-jobs')}
                    onNotifications={() => setProfileScreen('notifications')}
                    onHelp={() => setProfileScreen('help')}
                  />
                </div>
              </main>
            </div>
          </>
        )}

        {activeTab === 'profile' && profileScreen === 'my-jobs' && (
          <MyJobsScreen
            jobs={userJobs}
            loading={userJobsLoading}
            error={userJobsError}
            firstName={firstName}
            avatarUrl={avatarUrl}
            unreadCount={unreadCount}
            businesses={businesses}
            businessesLoading={showBusinessesLoading}
            onBack={() => setProfileScreen('main')}
            onNotificationsClick={openNotifications}
            onMessage={openChat}
          />
        )}

        {activeTab === 'profile' && profileScreen === 'notifications' && (
          <NotificationsScreen
            onBack={() => setProfileScreen('main')}
            onOpenChat={openChat}
          />
        )}

        {activeTab === 'profile' && profileScreen === 'help' && !supportChatOpen && (
          <HelpSupportScreen
            onBack={() => setProfileScreen('main')}
            onOpenSupportChat={openSupportChat}
          />
        )}
      </div>

      {showShell && activeTab === 'home' && (
        <AddJobFab
          disabled={!ENABLE_ADD_JOB}
          onClick={() => {
            if (!ENABLE_ADD_JOB) return;
            setAddJobOpen(true);
          }}
        />
      )}

      {addJobOpen && userId && userDocId && (
        <AddJobSheet
          open={addJobOpen}
          user={displayUser}
          uid={userId}
          userId={userDocId}
          matchedBusinesses={businesses}
          onClose={() => setAddJobOpen(false)}
          onJobPosted={() => {
            setBusinessesRefreshKey((key) => key + 1);
            setAddJobOpen(false);
            setActiveTab('profile');
            setProfileScreen('my-jobs');
          }}
        />
      )}

      {showShell && (
        <BottomNav active={activeTab} onChange={handleTabChange} />
      )}

      {activeContact && userId && (
        <ChatScreen
          contact={activeContact}
          userId={userId}
          onBack={clearActiveChat}
        />
      )}

      {supportChatOpen && userDocId && (
        <AdminSupportChatScreen
          userDocId={userDocId}
          onBack={() => setSupportChatOpen(false)}
        />
      )}
    </div>
  );
}
