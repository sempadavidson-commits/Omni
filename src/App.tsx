import React from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthModal } from './components/AuthModal';
import { BottomNav } from './components/BottomNav';
import { Splash } from './components/Splash';
import { CreateSimple } from './screens/CreateSimple';
import { Home } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { Live } from './screens/Live';
import { Messages } from './screens/Messages';
import { NotFound } from './screens/NotFound';
import { Notifications } from './screens/Notifications';
import { PostDetail } from './screens/PostDetail';
import { Profile } from './screens/Profile';
import { Search } from './screens/Search';
import { Settings } from './screens/Settings';

const IMMERSIVE_ROUTES = [/^\/create$/, /^\/live$/, /^\/post\//, /^\/messages\/[^/]+$/];

function Layout() {
  const location = useLocation();
  const showPrimaryNavigation = !IMMERSIVE_ROUTES.some(pattern => pattern.test(location.pathname));
  return <div className="flex h-[100dvh] w-full justify-center overflow-hidden bg-[#11110f]">
    <div className="relative flex h-full w-full max-w-[460px] flex-col border-x border-[var(--omni-border-subtle)] bg-omni-bg md:my-4 md:h-[calc(100dvh-2rem)] md:rounded-[var(--omni-radius-xl)] md:shadow-[var(--omni-shadow-raised)]">
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home/>}/><Route path="/search" element={<Search/>}/><Route path="/create" element={<CreateSimple/>}/><Route path="/live" element={<Live/>}/><Route path="/inbox" element={<Inbox/>}/><Route path="/inbox/activity" element={<Inbox/>}/><Route path="/inbox/messages" element={<Inbox/>}/><Route path="/messages" element={<Messages/>}/><Route path="/messages/:id" element={<Messages/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/profile" element={<Profile/>}/><Route path="/profile/:id" element={<Profile/>}/><Route path="/settings" element={<Settings/>}/><Route path="/post/:id" element={<PostDetail/>}/><Route path="*" element={<NotFound/>}/>
        </Routes>
      </main>
      {showPrimaryNavigation && <BottomNav/>}
      <AuthModal/>
    </div>
  </div>;
}

export default function App() {
  const [showSplash, setShowSplash] = React.useState(true);
  return <BrowserRouter><AppProvider>{showSplash ? <Splash onReady={() => setShowSplash(false)}/> : <Layout/>}</AppProvider></BrowserRouter>;
}
