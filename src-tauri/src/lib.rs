use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;

// 下載圖片的大小上限，跟圖庫上傳一樣 50MB
const MAX_IMAGE_BYTES: usize = 50 * 1024 * 1024;

// 黑板存進圖庫用，替網頁下載外部圖片，網頁自己抓會被 CORS 擋
// 只收 http/https、只收圖片、有大小上限
#[tauri::command]
async fn fetch_image(url: String) -> Result<tauri::ipc::Response, String> {
  if !url.starts_with("http://") && !url.starts_with("https://") {
    return Err("只收 http 或 https 網址".into());
  }

  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(20))
    .build()
    .map_err(|e| e.to_string())?;

  let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
  if !response.status().is_success() {
    return Err(format!("下載失敗 {}", response.status()));
  }

  let content_type = response
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("")
    .to_string();
  if !content_type.starts_with("image/") {
    return Err(format!("不是圖片 {}", content_type));
  }

  if let Some(length) = response.content_length() {
    if length as usize > MAX_IMAGE_BYTES {
      return Err("圖片超過 50MB".into());
    }
  }

  let bytes = response.bytes().await.map_err(|e| e.to_string())?;
  if bytes.len() > MAX_IMAGE_BYTES {
    return Err("圖片超過 50MB".into());
  }

  // 用二進位直接回傳，網頁拿到 ArrayBuffer，不用轉成很長的數字陣列
  Ok(tauri::ipc::Response::new(bytes.to_vec()))
}

// 最後取得焦點的視窗，koatag:// 匯入時交給它
struct LastFocused(Mutex<String>);

// 還沒被黑板拿走的匯入，(視窗 label, image_id)
// 視窗可能還沒載好，所以先排隊，黑板載好後自己來拿
struct PendingImports(Mutex<Vec<(String, u64)>>);

// koatag://import?image=1843 取出 image_id，格式不對回 None
// 開發版用 koatag-dev://，兩種都認
fn image_id_from_url(url: &Url) -> Option<u64> {
  if url.scheme() != "koatag" && url.scheme() != "koatag-dev" {
    return None;
  }
  if url.host_str() != Some("import") {
    return None;
  }
  for (key, value) in url.query_pairs() {
    if key == "image" {
      if let Ok(id) = value.parse::<u64>() {
        if id > 0 {
          return Some(id);
        }
      }
    }
  }
  None
}

// 匯入交給最後使用的視窗，那個視窗關了就交給主視窗
fn handle_import(app: &AppHandle, url: &Url) {
  let image_id = match image_id_from_url(url) {
    Some(id) => id,
    None => return,
  };

  let mut label = app.state::<LastFocused>().0.lock().unwrap().clone();
  if app.get_webview_window(&label).is_none() {
    label = "main".into();
  }

  app.state::<PendingImports>().0.lock().unwrap().push((label.clone(), image_id));

  if let Some(window) = app.get_webview_window(&label) {
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
  // 只通知那個視窗有東西可拿，內容由它呼叫 take_board_imports 取
  let _ = app.emit_to(label.as_str(), "board-import", ());
}

// 黑板拿走排給自己的匯入
#[tauri::command]
fn take_board_imports(pending: State<'_, PendingImports>, label: String) -> Vec<u64> {
  let mut list = pending.0.lock().unwrap();
  let mut ids = Vec::new();
  list.retain(|(l, id)| {
    if l == &label {
      ids.push(*id);
      return false;
    }
    true
  });
  ids
}

// 主視窗啟動時看看有沒有排給它的匯入，有就切到黑板頁
#[tauri::command]
fn count_board_imports(pending: State<'_, PendingImports>, label: String) -> usize {
  let list = pending.0.lock().unwrap();
  let mut count = 0;
  for (l, _) in list.iter() {
    if l == &label {
      count += 1;
    }
  }
  count
}

// 記錄開著哪些黑板視窗，重開 APP 時照著還原
fn windows_file(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  Ok(dir.join("windows.json"))
}

fn read_board_windows(app: &AppHandle) -> Vec<String> {
  let path = match windows_file(app) {
    Ok(p) => p,
    Err(_) => return Vec::new(),
  };
  let text = match std::fs::read_to_string(path) {
    Ok(t) => t,
    Err(_) => return Vec::new(),
  };
  serde_json::from_str(&text).unwrap_or_default()
}

fn write_board_windows(app: &AppHandle, labels: &Vec<String>) -> Result<(), String> {
  let path = windows_file(app)?;
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  }
  let text = serde_json::to_string(labels).map_err(|e| e.to_string())?;
  std::fs::write(path, text).map_err(|e| e.to_string())
}

// 黑板視窗的 label 只能是 board- 開頭加英數，拿來組檔名不會跑出資料夾
fn is_board_label(label: &str) -> bool {
  if !label.starts_with("board-") || label.len() > 40 {
    return false;
  }
  label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

// 開一個只有黑板的視窗，標題跟著產品名稱，開發版是 KOATAG Dev
fn build_board_window(app: &AppHandle, label: &str) -> Result<(), String> {
  let title = format!("{} 黑板", app.package_info().name);
  WebviewWindowBuilder::new(app, label, WebviewUrl::App("board-window".into()))
    .title(title)
    .inner_size(1100.0, 750.0)
    .min_inner_size(640.0, 480.0)
    // 拖放交給網頁處理，跟主視窗一樣
    .disable_drag_drop_handler()
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

// 新視窗的初始內容上限，跟後端雲端存檔差不多
const MAX_INITIAL_BYTES: usize = 2 * 1024 * 1024;

// 開新黑板視窗並記進 windows.json，回傳新視窗的 label
// 建視窗的指令要 async，Windows 上同步指令建視窗會卡死
// 有帶 initial 時先寫成新視窗的暫存檔，視窗一打開就讀得到
#[tauri::command]
async fn open_board_window(app: AppHandle, initial: Option<String>) -> Result<String, String> {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_nanos();
  let label = format!("board-{:x}", nanos);

  if let Some(text) = initial {
    if text.len() > MAX_INITIAL_BYTES {
      return Err("黑板內容太大".into());
    }
    // 只確認是 JSON，內容格式由網頁讀取時檢查
    serde_json::from_str::<serde_json::Value>(&text).map_err(|_| "黑板內容格式不對".to_string())?;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(format!("{}.json", label)), text).map_err(|e| e.to_string())?;
  }

  build_board_window(&app, &label)?;

  let mut labels = read_board_windows(&app);
  labels.push(label.clone());
  write_board_windows(&app, &labels)?;
  Ok(label)
}

// 關掉單一黑板視窗，這塊黑板不要了，從清單拿掉並刪暫存檔
#[tauri::command]
async fn close_board_window(app: AppHandle, label: String) -> Result<(), String> {
  if !is_board_label(&label) {
    return Err("不是黑板視窗".into());
  }

  let mut labels = read_board_windows(&app);
  labels.retain(|l| l != &label);
  write_board_windows(&app, &labels)?;

  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let _ = std::fs::remove_file(dir.join(format!("{}.json", label)));

  if let Some(window) = app.get_webview_window(&label) {
    window.destroy().map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 單一實例要第一個註冊，APP 開著時再點 koatag:// 不會多開
    // 開 deep-link 功能後，網址會轉給下面的 on_open_url
    .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
    .plugin(tauri_plugin_deep_link::init())
    // 讀寫檔案，範圍由 capabilities 限制在 APP 資料夾
    .plugin(tauri_plugin_fs::init())
    // 自動更新，檢查網址與公鑰寫在 tauri.conf.json
    .plugin(tauri_plugin_updater::Builder::new().build())
    // 更新裝好後重啟 APP
    .plugin(tauri_plugin_process::init())
    .manage(LastFocused(Mutex::new("main".into())))
    .manage(PendingImports(Mutex::new(Vec::new())))
    // 註冊自己寫的指令，網頁用 invoke('指令名') 呼叫
    .invoke_handler(tauri::generate_handler![
      fetch_image,
      open_board_window,
      close_board_window,
      take_board_imports,
      count_board_imports
    ])
    .on_window_event(|window, event| {
      match event {
        WindowEvent::Focused(true) => {
          let state = window.state::<LastFocused>();
          *state.0.lock().unwrap() = window.label().to_string();
        }
        // 關主視窗就結束整個 APP，其他黑板視窗留在清單裡下次還原
        WindowEvent::CloseRequested { .. } => {
          if window.label() == "main" {
            window.app_handle().exit(0);
          }
        }
        _ => {}
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 還原上次開著的黑板視窗
      let handle = app.handle().clone();
      for label in read_board_windows(&handle) {
        if is_board_label(&label) {
          let _ = build_board_window(&handle, &label);
        }
      }

      // 開發時沒經過安裝程式，要自己向 Windows 註冊 koatag://
      #[cfg(debug_assertions)]
      app.deep_link().register_all()?;

      // APP 開著時點連結
      let open_handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
          handle_import(&open_handle, &url);
        }
      });

      // APP 是被連結叫起來的
      if let Ok(Some(urls)) = app.deep_link().get_current() {
        for url in urls {
          handle_import(&handle, &url);
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
