// X 書籤在 APP 裡不靠擴充套件，改用 APP 自己的 x.com 登入狀態
// X 的視窗用專用的瀏覽器資料夾，跟 KOATAG 的登入完全分開
mod page;
pub mod fetch;
pub mod login;
pub mod session;

const LOGIN_LABEL: &str = "x-login";
const POPUP_PREFIX: &str = "x-popup-";
const HIDDEN_LABEL: &str = "x-hidden";

// 隱藏視窗裡執行的抓取程式
const FETCH_SCRIPT: &str = include_str!("x_fetch.js");
