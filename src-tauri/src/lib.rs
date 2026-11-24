use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

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

// 開一個只有黑板的視窗
fn build_board_window(app: &AppHandle, label: &str) -> Result<(), String> {
  WebviewWindowBuilder::new(app, label, WebviewUrl::App("board-window".into()))
    .title("KOATAG 黑板")
    .inner_size(1100.0, 750.0)
    .min_inner_size(640.0, 480.0)
    // 拖放交給網頁處理，跟主視窗一樣
    .disable_drag_drop_handler()
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

// 開新黑板視窗並記進 windows.json，回傳新視窗的 label
// 建視窗的指令要 async，Windows 上同步指令建視窗會卡死
#[tauri::command]
async fn open_board_window(app: AppHandle) -> Result<String, String> {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_nanos();
  let label = format!("board-{:x}", nanos);

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
    // 讀寫檔案，範圍由 capabilities 限制在 APP 資料夾
    .plugin(tauri_plugin_fs::init())
    .manage(LastFocused(Mutex::new("main".into())))
    // 註冊自己寫的指令，網頁用 invoke('指令名') 呼叫
    .invoke_handler(tauri::generate_handler![fetch_image, open_board_window, close_board_window])
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
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
