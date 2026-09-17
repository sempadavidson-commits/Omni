import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AppProvider } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';

// Screens
import { Home } from './screens/Home';
import { Messages } from './screens/Messages';
import { Create } from './screens/Create';
import { Notifications } from './screens/Notifications';
import { Profile } from './screens/Profile';
import { Search } from './screens/Search';
import { Inbox } from './screens/Inbox';
import { PostDetail } from './screens/PostDetail';
import { Live } from './screens/Live';

import { Splash } from './components/Splash';

function Layout() {
  return (
    <div className="w-full h-[100dvh] bg-black flex justify-center overflow-hidden">
      {/* Mobile constraint container for web preview */}
      <div className="w-full h-full max-w-md relative bg-black shadow-2xl flex flex-col">
        <main className="flex-1 relative h-full min-h-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/inbox/activity" element={<Inbox />} />
            <Route path="/inbox/messages" element={<Inbox />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/create" element={<Create />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/live" element={<Live />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Profile />} />
          </Routes>
        </main>
        
        <BottomNav />
        <AuthModal />
      </div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = React.useState(true);

  return (
    <BrowserRouter>
      <AppProvider>
        {showSplash ? (
          <Splash onReady={() => setShowSplash(false)} />
        ) : (
          <Layout />
        )}
        <Analytics />
      </AppProvider>
    </BrowserRouter>
  );
}
