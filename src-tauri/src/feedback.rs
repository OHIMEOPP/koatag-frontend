#[tauri::command]
pub fn open_feedback_form(url: tauri::Url) -> Result<(), String> {
  if url.scheme() != "https"
    || url.host_str() != Some("docs.google.com")
    || url.port().is_some()
    || !url.username().is_empty()
    || url.password().is_some()
    || !url.path().starts_with("/forms/d/e/")
    || !url.path().ends_with("/viewform")
  {
    return Err("Invalid Google Forms URL".into());
  }

  #[cfg(windows)]
  {
    use windows::{
      Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
      core::{HSTRING, PCWSTR, w},
    };

    let url = HSTRING::from(url.as_str());
    // Windows opens HTTPS links with the user's registered browser.
    let result = unsafe {
      ShellExecuteW(
        None,
        w!("open"),
        &url,
        PCWSTR::null(),
        PCWSTR::null(),
        SW_SHOWNORMAL,
      )
    };
    if result.0 as isize <= 32 {
      return Err(format!("ShellExecuteW failed ({})", result.0 as isize));
    }
    Ok(())
  }

  #[cfg(not(windows))]
  Err("Opening the form from the desktop app is only supported on Windows".into())
}
