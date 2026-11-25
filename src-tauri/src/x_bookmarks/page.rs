use serde_json::Value;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{Url, WebviewWindow};

// 在隱藏視窗執行 JS 並取回結果，結果轉成 JSON
// Windows 上拿不到 Promise 的值，所以抓取是先 start 再輪詢 take
pub(super) fn eval_value(window: &WebviewWindow, js: &str) -> Option<Value> {
  let (tx, rx) = mpsc::channel();
  let sent = window.eval_with_callback(js, move |text| {
    let _ = tx.send(text);
  });
  if sent.is_err() {
    return None;
  }
  let text = rx.recv_timeout(Duration::from_secs(5)).ok()?;
  serde_json::from_str(&text).ok()
}

// 換頁並等到載入完成，逾時回 false
pub(super) fn open_page(window: &WebviewWindow, page: &str) -> bool {
  let url = match Url::parse(page) {
    Ok(u) => u,
    Err(_) => return false,
  };
  if window.navigate(url).is_err() {
    return false;
  }
  let started = Instant::now();
  while started.elapsed() < Duration::from_secs(20) {
    thread::sleep(Duration::from_millis(300));
    let state = eval_value(window, "[location.href, document.readyState]");
    if let Some(Value::Array(parts)) = state {
      let href = parts.get(0).and_then(|v| v.as_str()).unwrap_or("");
      let ready = parts.get(1).and_then(|v| v.as_str()).unwrap_or("");
      if href.starts_with(page) && ready == "complete" {
        return true;
      }
    }
  }
  false
}
