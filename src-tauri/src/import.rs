use std::sync::Mutex;
use tauri::{App, AppHandle, Emitter, Manager, State, Url};
use tauri_plugin_deep_link::DeepLinkExt;

// 最後取得焦點的視窗，koatag:// 匯入時交給它
pub struct LastFocused(pub Mutex<String>);

// 還沒被黑板拿走的匯入，(視窗 label, image_id)
// 視窗可能還沒載好，所以先排隊，黑板載好後自己來拿
pub struct PendingImports(pub Mutex<Vec<(String, u64)>>);

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
pub fn take_board_imports(pending: State<'_, PendingImports>, label: String) -> Vec<u64> {
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
pub fn count_board_imports(pending: State<'_, PendingImports>, label: String) -> usize {
  let list = pending.0.lock().unwrap();
  let mut count = 0;
  for (l, _) in list.iter() {
    if l == &label {
      count += 1;
    }
  }
  count
}

// 接收 koatag:// 連結，APP 開著時點的與叫起 APP 的那一次都走這裡
pub fn listen(app: &App) -> Result<(), Box<dyn std::error::Error>> {
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
  let handle = app.handle().clone();
  if let Ok(Some(urls)) = app.deep_link().get_current() {
    for url in urls {
      handle_import(&handle, &url);
    }
  }
  Ok(())
}
