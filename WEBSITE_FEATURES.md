# KOATAG 網站功能文檔

## 📋 目錄
- [總體架構](#總體架構)
- [路由導覽](#路由導覽)
- [頁面功能詳解](#頁面功能詳解)
- [核心功能](#核心功能)
- [API 端點](#api-端點)

---

## 總體架構

### 應用程式概述
**KOATAG** 是一個圖片標籤管理系統，允許用戶上傳、分類、編輯和分享帶有自訂標籤的圖片。

### 技術棧
- **前端框架**：React 19 + TypeScript
- **路由管理**：React Router v7
- **樣式系統**：SCSS + CSS 變數
- **UI 組件庫**：Bootstrap 5.2.3
- **HTTP 客戶端**：Axios
- **圖片編輯**：Cropper.js

### 主要數據結構

#### Data 接口
```typescript
interface Data {
  images_Amount: number;           // 圖片總數
  tags_Amount: number;             // 標籤總數
  mainTag_Amount: number;          // 人物標籤數
  secondaryTag_Amount: number;     // 團體標籤數
  artist_Amount: number;           // 作者標籤數
  anotherTag_Amount: number;       // 其他標籤數
  duplicateTag: string[];          // 重複標籤列表
  
  UncategorizedTags: TagData[];    // 未分類標籤
  mainTags: TagData[];             // 人物標籤列表
  secondaryTags: TagData[];        // 團體標籤列表
  artistTags: TagData[];           // 作者標籤列表
  anotherTag: TagData[];           // 其他標籤列表
  tagsType: string[];              // 自訂標籤類型
  tagsGroup: TagData[];            // 標籤分組數據
}
```

---

## 路由導覽

### 主導覽結構

```
/                          → 登入頁面
  ↓ (登入後)
/main                      → 主應用程式容器
  ├── /main/front_page     → 首頁 (預設)
  ├── /main/upload_area    → 上傳區
  ├── /main/image_area     → 圖庫
  ├── /main/image_page     → 圖片詳情頁
  ├── /main/history        → 歷史記錄
  └── 設定、登出等菜單項
```

### 左側導航菜單項
1. 👤 個人資料
2. ❤️ 我的最愛
3. 📤 上傳圖片
4. 🖼️ 圖庫
5. 🔄 清單紀錄
6. ⚙️ 設定
7. 🔌 登出

---

## 頁面功能詳解

### 1️⃣ 登入頁面 (Login)
**路由**：`/`  
**檔案**：`src/pages/login.tsx`

#### 核心功能
- ✅ 帳號密碼登入
- ✅ 密碼顯示/隱藏切換
- ✅ 「記住帳號」功能 (30天 Cookie)
- ✅ 帳號驗證
- ✅ 錯誤提示反饋

#### 主要功能函數
```typescript
handleLogin()              // 提交登入表單
handleTogglePassword()     // 切換密碼可見性
```

#### 狀態管理
```typescript
account: string            // 帳號
password: string           // 密碼
showPassword: boolean      // 密碼可見性
remember: boolean          // 記住帳號
loading: boolean           // 載入狀態
```

#### 使用者互動流程
1. 輸入帳號和密碼
2. 選擇是否記住帳號
3. 點擊登入
4. 系統驗證並重定向到首頁

---

### 2️⃣ 首頁 (Front Page)
**路由**：`/main/front_page`  
**檔案**：`src/pages/front_page.tsx`

#### 核心功能
- 📊 顯示使用者資料統計
- 🏷️ 管理個人標籤
- 👤 個人資料區域（頭像、背景等）
- 📤 背景圖上傳功能
- 👀 查看公開標籤部落格

#### 主要組件
```
ProfileHeader           // 頭部個人信息卡片
├─ 頭像
├─ 使用者名稱
└─ 個人背景圖

TagBlog                // 標籤管理區
├─ 標籤分類標籤
│  ├─ 未分類
│  ├─ 人物
│  ├─ 團體
│  ├─ 作者
│  └─ 自訂類型
├─ 標籤列表顯示
├─ 編輯/刪除功能
└─ 標籤搜尋

StatisticsPanel       // 統計數據面板
├─ 擁有的圖片數量
├─ 擁有的標籤數量
├─ 人物標籤數量
├─ 團體標籤數量
├─ 作者標籤數量
├─ 其他標籤數量
└─ 重複標籤數量

PublicTagBlog        // 公開標籤區域
```

#### 主要功能函數
```typescript
current()              // 獲取首頁數據
openEdit()             // 開啟標籤編輯器
```

#### 數據流
1. 頁面加載時調用 `current()` 獲取使用者數據
2. 渲染統計面板
3. 顯示使用者的標籤分類
4. 使用者可以點擊標籤編輯/刪除

#### 背景設定
- 自動從後端載入使用者自訂背景圖
- 支持上傳新背景圖（按鈕在右下角）

---

### 3️⃣ 上傳區 (Upload Area)
**路由**：`/main/upload_area`  
**檔案**：`src/pages/upload_area.tsx`

#### 核心功能
- 📸 上傳本地圖片
- 🔗 從 URL 載入圖片
- 🏷️ 為圖片添加標籤
- 🌐 設定圖片公開/私密
- 📊 顯示伺服器上傳限制

#### 上傳限制驗證
```typescript
max_file_uploads        // 最多可上傳檔案數（通常 100）
upload_max_filesize_MB  // 單個檔案最大大小（MB）
post_max_size_MB        // 總上傳大小限制（MB）
```

#### 主要功能區域

##### 1. 本地圖片上傳
```typescript
uploads()               // 處理本地圖片選擇
```
- 驗證檔案數量
- 驗證單個檔案大小
- 驗證總體積大小
- 實時預覽圖片

##### 2. URL 圖片載入
```typescript
httpImageInputHandler()  // 處理 HTTP URL 圖片
```
- 輸入圖片 URL
- 預覽遠程圖片
- 驗證 URL 有效性

##### 3. 標籤設定
```typescript
Tag Category Selection
├─ 人物標籤
├─ 團體標籤
├─ 作者標籤
└─ 其他標籤

Tag Suggestion
└─ 根據使用者歷史標籤建議
```

##### 4. 圖片設定
```typescript
isPublic: boolean       // 公開/私密切換
uploadImageType: boolean // 圖片類型選擇
```

#### 提交流程
1. 選擇上傳圖片（本地或 URL）
2. 添加標籤（每個類別可多選）
3. 設定圖片屬性（公開/私密）
4. 點擊上傳
5. 系統驗證並保存

#### 錯誤提示
- ❌ 檔案數量超過限制
- ❌ 單個檔案太大
- ❌ 總體積超過限制
- ❌ URL 無效
- ❌ 檔案格式不支援

---

### 4️⃣ 圖庫 (Image Area)
**路由**：`/main/image_area`  
**檔案**：`src/pages/image_area.tsx`

#### 核心功能
- 🎞️ 顯示使用者上傳的所有圖片
- 🔍 按標籤篩選圖片
- 📊 分頁顯示（每頁 30 張）
- 🔄 排序功能
- 📝 編輯圖片標籤
- 🗑️ 刪除圖片

#### URL 參數
```
?page=1                 // 當前頁碼
&tag=標籤名             // 按標籤篩選
&group=標籤類型         // 按標籤類型篩選
```

#### 排序功能
```typescript
sortValue               // 排序欄位
├─ 上傳日期
├─ 修改日期
├─ 檔案名稱
└─ 尺寸

sortMethod             // 排序方向
├─ desc (降序)
└─ asc (升序)
```

#### 主要組件

##### ImageCard 圖片卡片
```
每張卡片顯示：
├─ 圖片縮圖
├─ 圖片資訊
│  ├─ 檔案名稱
│  ├─ 尺寸
│  ├─ 上傳日期
│  └─ 標籤
├─ 操作按鈕
│  ├─ 檢視詳情
│  ├─ 編輯標籤
│  ├─ 刪除
│  └─ 下載
└─ 編輯模式
   └─ 修改標籤
```

#### 主要功能函數
```typescript
handleSubmit()          // 獲取圖片列表
showsortimg()           // 排序圖片
handleSubmit(true)      // 重新載入數據
```

#### 標籤管理
```typescript
tagTypes = [
  { group: '人物', Tags: mainTags },
  { group: '團體', Tags: secondaryTags },
  { group: '作者', Tags: artistTags },
  { group: '其他', Tags: anotherTag }
]
```

#### 編輯模式
- 進入編輯模式時顯示標籤編輯器
- 每個標籤類別可修改標籤列表
- 支援新增自訂標籤
- 儲存變更時更新伺服器

#### 分頁邏輯
```typescript
visiblePages = 7        // 同時顯示的頁碼
totalPageAmount         // 總頁數
currentPage             // 當前頁碼
```

#### 安全機制
```typescript
// 頁數超出時自動重定向
if (totalPageAmount < page && totalPageAmount !== 0) {
  navigate("/main/image_area?page=1");
}
```

---

### 5️⃣ 圖片詳情頁 (Image Page)
**路由**：`/main/image_page?img_id={imageId}`  
**檔案**：`src/pages/image_page.tsx`

#### 核心功能
- 🔍 查看大尺寸圖片
- 🔎 圖片放大鏡功能
- 🏷️ 編輯圖片標籤
- 💾 保存變更
- ⬇️ 下載原始圖片
- 👁️ 切換公開/私密
- 🎨 背景編輯

#### 主要組件

##### ImageEditor 圖片編輯器
```
圖片編輯器區域
├─ 圖片展示
│  ├─ 原始圖片
│  ├─ 放大鏡視窗
│  └─ 縮放控制
├─ 標籤編輯區
│  ├─ 人物標籤
│  ├─ 團體標籤
│  ├─ 作者標籤
│  └─ 其他標籤
├─ 圖片設定
│  ├─ 公開/私密
│  ├─ 背景上傳
│  └─ 背景顯示
└─ 操作按鈕
   ├─ 保存
   ├─ 下載
   └─ 返回
```

#### Magnifier 放大鏡功能
```typescript
floatMirrorFollow()     // 跟隨滑鼠移動
getActualPos()          // 計算實際位置
boundaryDetection()     // 邊界檢測
zoomLevel               // 放大倍數 (預設 2x)
```

#### 主要功能函數
```typescript
downLoad()              // 下載圖片
updateImagePublicStatus() // 更新公開狀態
updateImageTags()       // 更新圖片標籤
updateAnotherTagValue() // 更新其他標籤
```

#### 標籤編輯流程
1. 在標籤區輸入或選擇標籤
2. 系統同步提示相關標籤
3. 點擊「保存」更新
4. 伺服器驗證並保存

#### 背景功能
- 上傳圖片背景
- 裁剪背景圖
- 實時預覽
- 保存為預設背景

#### Demo 標籤區域
```
展示所有相關標籤：
├─ 可點擊應用標籤
├─ 視覺高亮
└─ 快速選擇功能
```

---

### 6️⃣ 歷史記錄頁 (History)
**路由**：`/main/history`  
**檔案**：`src/pages/history.tsx`

#### 核心功能
- 📜 查看操作歷史
- 🔄 恢復之前的版本
- ⏱️ 時間軸顯示
- 📝 操作詳情

#### 數據結構
```typescript
interface HistoryRecord {
  id: string;
  timestamp: Date;
  action: string;          // 操作類型
  targetImage: string;     // 相關圖片
  changes: string;         // 變更內容
  user: string;            // 執行使用者
}
```

#### 主要功能
- 顯示所有編輯歷史
- 按日期排序
- 快速定位到特定圖片
- 查看修改詳情

---

## 核心功能

### 🏷️ 標籤系統

#### 標籤分類
```
1. 人物 (Main Tag)
   └─ 用於標記圖片中出現的人物角色
   
2. 團體 (Secondary Tag)
   └─ 用於標記人物所屬團體/作品
   
3. 作者 (Artist Tag)
   └─ 用於標記圖片原作者/繪師
   
4. 其他 (Another Tag)
   └─ 用於自訂分類（可無限擴展）
   
5. 未分類 (Uncategorized)
   └─ 系統默認分類，等待使用者分類
```

#### 標籤操作
- ➕ 新增標籤
- ✏️ 編輯標籤名稱
- 🗑️ 刪除標籤
- 🔍 搜尋標籤
- 💾 批量更新
- 🔗 標籤鏈接

#### TagInput 組件
```typescript
props {
  allTags: Record<string, TagData[]>   // 所有可用標籤
  onChange: (value: string) => void    // 值改變回調
  placeholder?: string                  // 佔位符文本
  isTextarea?: boolean                  // 是否多行模式
}
```

### 📸 圖片管理

#### 圖片生命週期
```
上傳 → 驗證 → 存儲 → 標籤 → 預覽 → 分享
  ↓
編輯 → 保存 → 更新
  ↓
刪除 → 清理
```

#### 圖片屬性
```typescript
interface Image {
  id: string;
  img_path: string;         // 圖片路徑
  thumbnail_path: string;   // 縮圖路徑
  filename: string;         // 檔案名稱
  filesize: number;         // 檔案大小 (bytes)
  width: number;            // 寬度 (px)
  height: number;           // 高度 (px)
  is_public: 'public' | 'private';  // 公開狀態
  upload_date: string;      // 上傳日期
  modified_date: string;    // 修改日期
  user_id: string;          // 所有者
}
```

#### 圖片操作
- ⬆️ 上傳
- 👁️ 預覽
- 🔍 放大
- ✏️ 編輯標籤
- 🔄 替換圖片
- 🗑️ 刪除
- ⬇️ 下載
- 🔗 分享鏈接

### 🖼️ 背景系統

#### 背景類型
```
1. 預設背景
   └─ 系統默認背景圖
   
2. 使用者自訂背景
   └─ 上傳的個人背景
   
3. 臨時背景
   └─ 於編輯時使用但未保存
```

#### 背景操作
- 📤 上傳新背景
- 🔄 替換背景
- 👁️ 預覽
- 💾 保存設定
- 🔄 恢復默認

### 👤 使用者系統

#### 認證流程
```
輸入帳號密碼 → 驗證 → 登入 → 設定 Session/Token → 重定向首頁
```

#### 使用者數據
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;          // 頭像路徑
  registration_date: string;
  last_login: string;
  preferences: {
    language: string;
    theme: string;
    notifications: boolean;
  }
}
```

#### 認證功能
- 🔐 登入/登出
- 🍪 記住帳號（Cookie）
- 🔒 會話管理
- 👤 個人資料管理

---

## API 端點

### 認證相關
```
POST   /login                              登入
GET    /logout                             登出
POST   /register                           註冊
GET    /auth/verify                        驗證 Token
```

### 首頁相關
```
GET    /pageInfo/getImageForFront/:user_id     獲取首頁數據
GET    /pageInfo/getImageForHistory/:user_id   獲取歷史數據
```

### 圖片相關
```
GET    /images/list                             獲取圖片列表
GET    /images/:id                              獲取圖片詳情
POST   /images/upload                           上傳圖片
POST   /images/:id/update                       更新圖片資訊
DELETE /images/:id                              刪除圖片
GET    /images/:id/download                     下載圖片

排序/篩選參數：
?sort=upload_date&order=desc
?tag=tag_name&group=group_name
?page=1&limit=30
```

### 標籤相關
```
GET    /tags/list                               獲取標籤列表
GET    /tags/:group                             按類型獲取標籤
POST   /tags/create                             建立新標籤
POST   /tags/:id/update                         更新標籤
DELETE /tags/:id                                刪除標籤
POST   /images/:id/tags/update                  更新圖片標籤

標籤類型：
- mainTag (人物)
- secondaryTag (團體)
- ArtistTag (作者)
- anotherTag (其他)
- UncategorizedTags (未分類)
```

### 背景相關
```
POST   /user/background/upload                 上傳背景圖
GET    /user/background                        獲取背景設定
POST   /user/background/update                 更新背景
DELETE /user/background                        刪除背景
```

### 上傳區相關
```
GET    /pageInfo/uploadAreaInfo                獲取上傳限制
POST   /images/validate                        驗證圖片
```

---

## 使用流程圖

### 新使用者流程
```
訪問網站
    ↓
[登入頁面]
    ├─ 輸入帳號/密碼
    ├─ 勾選記住帳號
    └─ 點擊登入
    ↓
[系統驗證]
    ├─ 檢查帳號存在性
    ├─ 驗證密碼
    └─ 建立會話
    ↓
[首頁]
    ├─ 查看個人資料
    ├─ 查看統計數據
    └─ 瀏覽公開標籤
    ↓
[上傳區] - 上傳第一張圖片
    ├─ 選擇圖片
    ├─ 添加標籤
    ├─ 設定公開狀態
    └─ 上傳
    ↓
[圖庫] - 查看上傳的圖片
    ├─ 瀏覽圖片
    ├─ 按標籤篩選
    └─ 編輯標籤
    ↓
[圖片詳情頁] - 編輯圖片
    ├─ 使用放大鏡檢視
    ├─ 編輯標籤
    ├─ 設定公開狀態
    └─ 保存
```

### 圖片管理流程
```
[圖庫頁面]
    ├─ 查看所有圖片
    ├─ 按標籤篩選
    ├─ 排序圖片
    └─ 分頁瀏覽
         ↓
    [編輯模式]
        ├─ 修改標籤
        ├─ 修改公開狀態
        └─ 批量操作
             ↓
        [圖片詳情頁]
            ├─ 精細編輯
            ├─ 放大鏡檢視
            ├─ 背景編輯
            └─ 下載/分享
```

---

## 性能最佳化

### 前端優化
- ✅ React.useCallback - 避免不必要的重新渲染
- ✅ React.useMemo - 記憶化計算結果
- ✅ 圖片懶加載 - 只加載可見圖片
- ✅ 虛擬滾動 - 處理大量圖片列表
- ✅ 事件委派 - 減少事件監聽器數量

### 伺服器優化
- ✅ 分頁加載 - 每頁 30 張圖片
- ✅ 縮圖預加載 - 使用低分辨率縮圖
- ✅ 快取機制 - 減少重複請求
- ✅ CDN 分發 - 加速圖片加載

---

## 安全機制

### 認證與授權
- 🔐 密碼加密存儲
- 🔑 Session 令牌驗證
- 🚫 CORS 防護
- 🔓 登出清除會話

### 圖片安全
- 👤 訪問權限檢驗
- 🔍 檔案格式驗證
- 📊 大小限制檢查
- 🛡️ 病毒掃描（後端）

### 資料安全
- 🔒 HTTPS 加密傳輸
- 📝 操作日誌記錄
- 🗑️ 刪除資料永久清理
- 🔄 備份機制

---

## 錯誤處理

### 常見錯誤碼
```
200  OK                    請求成功
201  Created               資源已創建
400  Bad Request           請求格式錯誤
401  Unauthorized          未授權/需登入
403  Forbidden             無權訪問
404  Not Found             資源不存在
413  Payload Too Large     檔案過大
429  Too Many Requests     請求過於頻繁
500  Server Error          伺服器錯誤
```

### 錯誤訊息顯示
```typescript
$message(text: string, type: 'success' | 'warning' | 'error')
// 使用統一的消息提示組件
```

---

## 版本信息

- **應用版本**：1.0.0
- **最後更新**：2026年1月1日
- **維護者**：KOATAG Team
- **License**：MIT

---

## 相關文檔

- [設計系統](./DESIGN_SYSTEM.md) - UI/UX 設計規範
- [API 文檔](./API_DOCS.md) - 詳細 API 說明
- [開發指南](./DEVELOPMENT.md) - 開發環境設置
- [部署指南](./DEPLOYMENT.md) - 部署和配置

