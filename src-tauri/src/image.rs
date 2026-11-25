use std::time::Duration;

// 下載圖片的大小上限，跟圖庫上傳一樣 50MB
const MAX_IMAGE_BYTES: usize = 50 * 1024 * 1024;

// 黑板存進圖庫用，替網頁下載外部圖片，網頁自己抓會被 CORS 擋
// 只收 http/https、只收圖片、有大小上限
#[tauri::command]
pub async fn fetch_image(url: String) -> Result<tauri::ipc::Response, String> {
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
