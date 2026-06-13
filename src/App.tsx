import { ScrollTop, ScrollToTop } from 'components';
import React, { lazy, Suspense } from 'react';
import './App.css';
import Main from './Main';
import { Login } from 'pages';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Test from 'pages/test';
import { getUserId } from 'utils';

// Public share-link landing — 不需 auth，放 App-level Routes 外於 /main/* gate
const ShareLinkLandingPage = lazy(
  () => import('pages/drive/ShareLinkLandingPage'),
);

declare global {
  interface Window {
    user_id: string;
  }
}

// Initial mirror for any legacy global reader (set once at load). The route
// guards below read auth state FRESH per render — not from this snapshot.
window.user_id = getUserId();
localStorage.setItem('user_id', window.user_id);

// R2 #4 cutover (backlog b) — login.tsx now navigates instead of full-reloading,
// so the in-memory E2EE key bundle survives login (the cutover's whole premise:
// encrypted upload needs masterPubkey alive after login). For routing to pick up
// the freshly-written token — instead of a stale module-load snapshot that would
// bounce a just-logged-in user back to /login — the guards read localStorage on
// every render via wrapper components, which <Routes> re-renders on each location
// change. A full reload (logout, change-password) still works: a fresh load reads
// fresh too.
function isAuthed(): boolean {
  return !!localStorage.getItem('token') && !!getUserId();
}

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  isAuthed() ? <>{children}</> : <Navigate to="/login" replace />;

const RedirectIfAuthed: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  isAuthed() ? <Navigate to="/main/front_page" replace /> : <>{children}</>;

const RootRedirect: React.FC = () => (
  <Navigate to={isAuthed() ? '/main/front_page' : '/login'} replace />
);

function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/main/drive/share/:token"
          element={
            <Suspense fallback={<div className="drive-loading">載入中…</div>}>
              <ShareLinkLandingPage />
            </Suspense>
          }
        />
        <Route
          path="/main/*"
          element={
            <RequireAuth>
              <Main />
            </RequireAuth>
          }
        />
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/test"
          element={<Test
            src="https://picsum.photos/800/600"
            title="測試圖片"
            description="這是一張隨機的測試圖片，示範圖片資訊頁面。"
            uploader="Admin"
            uploadDate="2025-08-31"
            resolution="1920x1080"
            size="1.2 MB"
          />
          }
        />
      </Routes>
      <ScrollToTop />
    </BrowserRouter>
  );
}

export default App;
