import { ScrollTop, ScrollToTop } from 'components';
import './App.css';
import Main from './Main';
import { Login } from 'pages';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Test from 'pages/test';
import { getUserId } from 'utils';

const token = localStorage.getItem('token');
const user_id = getUserId();

declare global {
  interface Window {
    user_id: string;
  }
}
localStorage.setItem('user_id', user_id);
window.user_id = user_id;

// console.log(token, user_id) //正常執行一次
function App() {
  // console.log(token, user_id) // 異常執行兩次
  return (
    <BrowserRouter>
      <ScrollTop />
      <Routes>
        <Route
          path="/login"
          element={!token || !user_id ? <Login /> : <Navigate to="/main/front_page" replace />}
        />
        <Route
          path="/main/*"
          element={token && user_id ? <Main /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/"
          element={<Navigate to={token && user_id ? "/main/front_page" : "/login"} replace />}
        />
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