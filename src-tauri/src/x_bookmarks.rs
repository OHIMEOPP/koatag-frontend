use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread;
use std::time::Duration;
use tauri::webview::{Cookie, NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry};

// X 書籤在 APP 裡不靠擴充套件，改用 APP 自己的 x.com 登入狀態
// X 的視窗用專用的瀏覽器資料夾，跟 KOATAG 的登入完全分開
const LOGIN_LABEL: &str = "x-login";
const LOGIN_URL: &str = "https://x.com/login";
const POPUP_PREFIX: &str = "x-popup-";
const HIDDEN_LABEL: &str = "x-hidden";

// 彈出視窗編號，同時開好幾個 label 才不會撞
static POPUP_COUNT: AtomicU32 = AtomicU32::new(0);

// 回給網頁的格式跟擴充套件的 session 一樣
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XSession {
  ok: bool,
  logged_in: bool,
  x_user_id: Option<String>,
}

fn x_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  Ok(dir.join("x-webview"))
}

// 隱藏的 X 視窗，讀 cookie、登出、之後抓書籤都用它
// 沒開過就開一個，不顯示
fn hidden_window(app: &AppHandle) -> Result<WebviewWindow, String> {
  if let Some(window) = app.get_webview_window(HIDDEN_LABEL) {
    return Ok(window);
  }
  let url = Url::parse("about:blank").map_err(|e| e.to_string())?;
  WebviewWindowBuilder::new(app, HIDDEN_LABEL, WebviewUrl::External(url))
    .data_directory(x_data_dir(app)?)
    .visible(false)
    .build()
    .map_err(|e| e.to_string())
}

// Windows 上讀 cookie 不能在同步指令裡，會卡死
fn x_cookies(app: &AppHandle) -> Result<Vec<Cookie<'static>>, String> {
  let window = hidden_window(app)?;
  let url = Url::parse("https://x.com").map_err(|e| e.to_string())?;
  window.cookies_for_url(url).map_err(|e| e.to_string())
}

// auth_token 只有登入後才有，twid 的值是 u%3D 加上 X 帳號 id
fn session_from(cookies: &Vec<Cookie<'static>>) -> XSession {
  let mut has_token = false;
  let mut user_id = None;
  for cookie in cookies {
    if cookie.name() == "auth_token" && !cookie.value().is_empty() {
      has_token = true;
    }
    if cookie.name() == "twid" {
      let value = cookie.value().replace("u%3D", "").replace("u=", "");
      if !value.is_empty() {
        user_id = Some(value);
      }
    }
  }
  XSession {
    ok: true,
    logged_in: has_token,
    x_user_id: user_id,
  }
}

#[tauri::command]
pub async fn x_session(app: AppHandle) -> Result<XSession, String> {
  let cookies = x_cookies(&app)?;
  Ok(session_from(&cookies))
}

// 開 X 官方登入頁，帳密只在 X 的頁面輸入
// 已經開著就拉到前面
#[tauri::command]
pub async fn x_login(app: AppHandle) -> Result<(), String> {
  if let Some(window) = app.get_webview_window(LOGIN_LABEL) {
    let _ = window.unminimize();
    let _ = window.set_focus();
    return Ok(());
  }

  let url = Url::parse(LOGIN_URL).map_err(|e| e.to_string())?;
  let popup_app = app.clone();
  WebviewWindowBuilder::new(&app, LOGIN_LABEL, WebviewUrl::External(url))
    .data_directory(x_data_dir(&app)?)
    .title("登入 X")
    .inner_size(520.0, 760.0)
    .on_new_window(move |url, features| open_popup(&popup_app, url, features))
    .build()
    .map_err(|e| e.to_string())?;

  let handle = app.clone();
  thread::spawn(move || watch_login(handle));
  Ok(())
}

// X 的 Google、Apple 登入會開彈出視窗，在 APP 裡接住
// 開在外部瀏覽器的話登入狀態留在瀏覽器，APP 讀不到
// window_features 會沿用登入視窗的瀏覽器環境，所以也在 X 專用資料夾裡
fn open_popup(app: &AppHandle, url: Url, features: NewWindowFeatures) -> NewWindowResponse<Wry> {
  let number = POPUP_COUNT.fetch_add(1, Ordering::SeqCst);
  let label = format!("{}{}", POPUP_PREFIX, number);
  let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
    .window_features(features)
    .title("登入 X")
    .build();
  match built {
    Ok(window) => NewWindowResponse::Create { window },
    Err(_) => NewWindowResponse::Deny,
  }
}

// 關掉登入視窗與所有彈出視窗
fn close_login_windows(app: &AppHandle) {
  for (label, window) in app.webview_windows() {
    if label == LOGIN_LABEL || label.starts_with(POPUP_PREFIX) {
      let _ = window.destroy();
    }
  }
}

// 每秒看一次有沒有登入，登入了就關掉登入視窗
// 使用者自己關掉視窗也停止，兩種情況都通知網頁重新偵測
fn watch_login(app: AppHandle) {
  loop {
    thread::sleep(Duration::from_secs(1));
    if app.get_webview_window(LOGIN_LABEL).is_none() {
      break;
    }
    let cookies = match x_cookies(&app) {
      Ok(c) => c,
      Err(_) => continue,
    };
    if session_from(&cookies).logged_in {
      close_login_windows(&app);
      break;
    }
  }
  let _ = app.emit("x-session-changed", ());
}

// 清空 X 專用資料夾的瀏覽資料，X、Google、Apple 的登入一起清掉
// 逐筆刪 cookie 刪不乾淨，網域開頭的點會被吃掉對不上
// KOATAG 自己的登入在另一個資料夾，不受影響
#[tauri::command]
pub async fn x_logout(app: AppHandle) -> Result<(), String> {
  close_login_windows(&app);
  let window = hidden_window(&app)?;
  window.clear_all_browsing_data().map_err(|e| e.to_string())?;
  let _ = app.emit("x-session-changed", ());
  Ok(())
}
