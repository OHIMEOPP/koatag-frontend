use super::page::{eval_value, open_page};
use super::session::{cookie_value, hidden_window, session_from, x_cookies};
use super::FETCH_SCRIPT;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::AppHandle;

// 平常停在這頁抓取，同源才帶得到 cookie，又不會跑 X 的網頁程式
const IDLE_PAGE: &str = "https://x.com/robots.txt";

// 每次抓取的編號，用來取回對應的結果
static REQUEST_COUNT: AtomicU32 = AtomicU32::new(0);
// 同一時間只抓一頁，避免兩個請求同時切換隱藏視窗的頁面
static FETCH_LOCK: Mutex<()> = Mutex::new(());

fn failed_page(kind: &str, status: &str) -> Value {
  json!({ "ok": false, "status": status, "kind": kind, "items": [], "nextCursor": null })
}

// 後端給的 queryId 只收英數、底線、連字號，不合格就當沒給，用內建值
fn checked_query_id(value: Option<String>) -> Option<String> {
  let id = value?;
  if id.is_empty() || id.len() > 64 {
    return None;
  }
  if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
    return None;
  }
  Some(id)
}

fn fetch_page_blocking(
  app: &AppHandle,
  kind: &str,
  cursor: Option<String>,
  bookmarks_query_id: Option<String>,
  likes_query_id: Option<String>,
) -> Result<Value, String> {
  let _guard = FETCH_LOCK.lock().unwrap();

  let cookies = x_cookies(app)?;
  let session = session_from(&cookies);
  let ct0 = cookie_value(&cookies, "ct0");
  if !session.logged_in || ct0.is_none() {
    return Ok(failed_page(kind, "x_not_logged_in"));
  }

  let window = hidden_window(app)?;

  // 停在 robots.txt 抓取，不讓 X 的網頁程式在背景跑
  let at_idle = match window.url() {
    Ok(u) => u.as_str() == IDLE_PAGE,
    Err(_) => false,
  };
  if !at_idle && !open_page(&window, IDLE_PAGE) {
    return Ok(failed_page(kind, "x_error"));
  }

  let req_id = REQUEST_COUNT.fetch_add(1, Ordering::SeqCst);
  let params = json!({
    "kind": kind,
    "cursor": cursor,
    "ct0": ct0,
    "userId": session.x_user_id,
    "bookmarksQueryId": checked_query_id(bookmarks_query_id),
    "likesQueryId": checked_query_id(likes_query_id),
  });
  // 參數用 JSON 組，不會被當成程式碼
  window.eval(FETCH_SCRIPT).map_err(|e| e.to_string())?;
  window
    .eval(format!("window.__koatag.start({}, {})", req_id, params))
    .map_err(|e| e.to_string())?;

  let take = format!("window.__koatag ? window.__koatag.take({}) : null", req_id);
  let started = Instant::now();
  while started.elapsed() < Duration::from_secs(30) {
    thread::sleep(Duration::from_millis(200));
    let page = match eval_value(&window, &take) {
      Some(v) => v,
      None => continue,
    };
    if page.is_null() {
      continue;
    }
    return Ok(page);
  }
  Ok(failed_page(kind, "x_error"))
}

// 抓一頁 X 書籤或喜歡，回傳格式跟擴充套件一樣
// queryId 由網頁從後端 x-config 拿來，沒有就用 x_fetch.js 的內建值
// 要等頁面載入與輪詢，放到背景執行緒做
#[tauri::command]
pub async fn x_fetch_page(
  app: AppHandle,
  kind: String,
  cursor: Option<String>,
  bookmarks_query_id: Option<String>,
  likes_query_id: Option<String>,
) -> Result<Value, String> {
  let mut checked_kind = "bookmarks".to_string();
  if kind == "likes" {
    checked_kind = "likes".to_string();
  }
  tauri::async_runtime::spawn_blocking(move || {
    fetch_page_blocking(&app, &checked_kind, cursor, bookmarks_query_id, likes_query_id)
  })
  .await
  .map_err(|e| e.to_string())?
}
