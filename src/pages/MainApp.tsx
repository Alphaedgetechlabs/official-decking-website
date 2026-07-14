import { useEffect, useMemo, useState } from 'react';
import { AddJobFab } from '../components/addJob/AddJobFab';
import { AddJobSheet } from '../components/addJob/AddJobSheet';
import { BottomNav } from '../components/home/BottomNav';
import { HomeGreeting, HomeTopBar } from '../components/home/HomeHeader';
import { HomeTradiesSection } from '../components/home/HomeTradiesSection';
import { Sidebar } from '../components/home/Sidebar';
import { DesktopTopBar } from '../components/layout/DesktopTopBar';
import { BusinessMessagesList } from '../components/messages/BusinessMessagesList';
import { ChatScreen } from '../components/messages/ChatScreen';
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
import { useAuthUid } from '../hooks/useAuthUid';
import { useDashboardUser } from '../hooks/useUserData';
import { useMatchedBusinesses } from '../hooks/useMatchedBusinesses';
import { useUserJobs } from '../hooks/useUserJobs';
import { fetchBusinessById } from '../services/businessService';
import { logoutUser } from '../services/authService';
import {
  initUserPresence,
  teardownUserPresence,
} from '../services/rtdb/presenceService';
import { getFirstName } from '../types/user';
import { businessToMessageItem } from '../utils/businessToMessage';
import type { NavTab } from '../types/nav';
import type { ProfileScreen } from '../types/profile';
import { useNotificationStore } from '../stores/notificationStore';
import { clearSession, getStoredPhoneId } from '../utils/session';
import { useAuthFlowStore } from '../stores/authFlowStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { prefetchDashboardForUser, ensureInstantBusinesses } from '../lib/dashboardBusinesses';

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
  const [businessesRefreshKey, setBusinessesRefreshKey] = useState(0);
  const [resolvedContact, setResolvedContact] = useState<MessageItem | null>(
    null,
  );
  const cachedUser = useDashboardStore((s) => s.user);
  const { authUid, authReady } = useAuthUid();
  const { user, loading, error } = useDashboardUser();
  const displayUser = user ?? cachedUser;

  const userId = authUid ?? '';
  const userDocId = displayUser?.phone ?? getStoredPhoneId();

  const {
    jobs: userJobs,
    loading: userJobsLoading,
    error: userJobsError,
  } = useUserJobs(authUid, displayUser, userDocId ?? '');

  const businesses = useDashboardStore((s) => s.businesses);
  const {
    loading: businessesLoading,
    error: businessesError,
  } = useMatchedBusinesses(userJobs, displayUser, businessesRefreshKey);
  const showBusinessesLoading = businessesLoading && businesses.length === 0;

  const unreadCount = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.read).length,
  );
  const initNotifications = useNotificationStore((s) => s.init);
  const teardownNotifications = useNotificationStore((s) => s.teardown);

  const businessIds = useMemo(
    () => businesses.map((business) => business.id),
    [businesses],
  );

  const {
    messages: inboxMessages,
    loading: inboxLoading,
    error: inboxError,
  } = useConversationInbox(userId, userDocId, businesses);

  const businessMessages = useMemo(
    () =>
      businesses.map((business, index) =>
        businessToMessageItem(business, userId, index),
      ),
    [businesses, userId],
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
    if (!authReady || !userId) return;
    initNotifications(userId, userDocId, businessIds);
    return () => teardownNotifications();
  }, [
    authReady,
    userId,
    userDocId,
    businessIds,
    initNotifications,
    teardownNotifications,
  ]);

  const openNotifications = () => {
    setActiveTab('profile');
    setProfileScreen('notifications');
    setActiveChatId(null);
  };

  const handleLogout = () => {
    teardownNotifications();
    teardownUserPresence();
    useAuthFlowStore.getState().clear();
    useDashboardStore.getState().clear();
    clearSession();
    onLogout();
    void logoutUser().catch((err) => {
      console.error('Logout error:', err);
    });
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== 'profile') {
      setProfileScreen('main');
    }
  };

  const openChat = (businessId: string) => {
    setActiveTab('messages');
    setProfileScreen('main');
    setActiveChatId(businessId);
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
  const showShell = !activeChatId && !isProfileSubScreen;

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
                <HomeTradiesSection
                  businesses={businesses}
                  loading={showBusinessesLoading}
                  error={businessesError}
                  onMessage={openChat}
                />
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
                  messages={inboxMessages}
                  loading={showBusinessesLoading || inboxLoading}
                  error={businessesError ?? inboxError}
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

        {activeTab === 'profile' && profileScreen === 'help' && (
          <HelpSupportScreen onBack={() => setProfileScreen('main')} />
        )}
      </div>

      {showShell && activeTab === 'home' && (
        <AddJobFab onClick={() => setAddJobOpen(true)} />
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
          onBack={() => setActiveChatId(null)}
        />
      )}
    </div>
  );
}
