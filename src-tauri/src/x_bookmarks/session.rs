use super::HIDDEN_LABEL;
use serde::Serialize;
use std::path::PathBuf;
use tauri::webview::Cookie;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

// 回給網頁的格式跟擴充套件的 session 一樣
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XSession {
  ok: bool,
  pub(super) logged_in: bool,
  pub(super) x_user_id: Option<String>,
}

pub(super) fn x_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  Ok(dir.join("x-webview"))
}

// 隱藏的 X 視窗，讀 cookie、登出、抓書籤都用它
// 沒開過就開一個，不顯示
pub(super) fn hidden_window(app: &AppHandle) -> Result<WebviewWindow, String> {
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
pub(super) fn x_cookies(app: &AppHandle) -> Result<Vec<Cookie<'static>>, String> {
  let window = hidden_window(app)?;
  let url = Url::parse("https://x.com").map_err(|e| e.to_string())?;
  window.cookies_for_url(url).map_err(|e| e.to_string())
}

// auth_token 只有登入後才有，twid 的值是 u%3D 加上 X 帳號 id
pub(super) fn session_from(cookies: &Vec<Cookie<'static>>) -> XSession {
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

pub(super) fn cookie_value(cookies: &Vec<Cookie<'static>>, name: &str) -> Option<String> {
  for cookie in cookies {
    if cookie.name() == name && !cookie.value().is_empty() {
      return Some(cookie.value().to_string());
    }
  }
  None
}

#[tauri::command]
pub async fn x_session(app: AppHandle) -> Result<XSession, String> {
  let cookies = x_cookies(&app)?;
  Ok(session_from(&cookies))
}
