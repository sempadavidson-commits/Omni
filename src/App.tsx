import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

function Layout() {
  const location = useLocation();
  const hideNav = location.pathname === '/create';

  return (
    <div className="w-full h-[100dvh] bg-black flex justify-center overflow-hidden">
      {/* Mobile constraint container for web preview */}
      <div className="w-full h-full max-w-md relative bg-black border-x border-zinc-900/50 shadow-2xl flex flex-col">
        <main className="flex-1 relative h-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/create" element={<Create />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/search" element={<Search />} />
          </Routes>
        </main>
        
        {!hideNav && <BottomNav />}
        <AuthModal />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout />
      </AppProvider>
    </BrowserRouter>
  );
}
