use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

// 新視窗的初始內容上限，跟後端雲端存檔差不多
const MAX_INITIAL_BYTES: usize = 2 * 1024 * 1024;

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

// 還原上次開著的黑板視窗
pub fn restore(app: &AppHandle) {
  for label in read_board_windows(app) {
    if is_board_label(&label) {
      let _ = build_board_window(app, &label);
    }
  }
}

// 開新黑板視窗並記進 windows.json，回傳新視窗的 label
// 建視窗的指令要 async，Windows 上同步指令建視窗會卡死
// 有帶 initial 時先寫成新視窗的暫存檔，視窗一打開就讀得到
#[tauri::command]
pub async fn open_board_window(app: AppHandle, initial: Option<String>) -> Result<String, String> {
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
pub async fn close_board_window(app: AppHandle, label: String) -> Result<(), String> {
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
