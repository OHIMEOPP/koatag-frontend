// 各功能分檔，這裡只負責組裝外掛、狀態、指令與視窗事件
mod board_window;
mod image;
mod import;
mod x_bookmarks;

use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 單一實例要第一個註冊，APP 開著時再點 koatag:// 不會多開
    // 開 deep-link 功能後，網址會轉給 import::listen 的 on_open_url
    .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
    .plugin(tauri_plugin_deep_link::init())
    // 讀寫檔案，範圍由 capabilities 限制在 APP 資料夾
    .plugin(tauri_plugin_fs::init())
    // 自動更新，檢查網址與公鑰寫在 tauri.conf.json
    .plugin(tauri_plugin_updater::Builder::new().build())
    // 更新裝好後重啟 APP
    .plugin(tauri_plugin_process::init())
    .manage(import::LastFocused(Mutex::new("main".into())))
    .manage(import::PendingImports(Mutex::new(Vec::new())))
    // 註冊自己寫的指令，網頁用 invoke('指令名') 呼叫
    .invoke_handler(tauri::generate_handler![
      image::fetch_image,
      board_window::open_board_window,
      board_window::close_board_window,
      import::take_board_imports,
      import::count_board_imports,
      x_bookmarks::session::x_session,
      x_bookmarks::login::x_login,
      x_bookmarks::login::x_logout,
      x_bookmarks::fetch::x_fetch_page
    ])
    .on_window_event(|window, event| {
      match event {
        // 只記主視窗跟黑板，X 登入視窗不收匯入
        WindowEvent::Focused(true) => {
          let label = window.label();
          if label == "main" || label.starts_with("board-") {
            let state = window.state::<import::LastFocused>();
            *state.0.lock().unwrap() = label.to_string();
          }
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

      board_window::restore(app.handle());
      import::listen(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
