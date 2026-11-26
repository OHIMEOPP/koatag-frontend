// 桌面版發版：改版本號、commit、push、打 tag、push tag，tag 推上去後 GitHub Actions 會打包
// 用法：npm run desktop:release 0.0.2 "這版改了什麼"
// 條列：npm run desktop:release 0.0.2 "第一點" "第二點"，每個參數一條
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const confPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const lockPath = path.join(root, 'src-tauri', 'Cargo.lock');

const fail = (message) => {
  console.error('[desktop-release] ' + message);
  process.exit(1);
};

const git = (args) => {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
};

// git 指令直接把輸出印出來，push 時看得到進度
const gitShow = (args) => {
  execFileSync('git', args, { cwd: root, stdio: 'inherit' });
};

const version = process.argv[2];

// 多個參數各算一條 前面加 - 用換行接起來 只有一個就照原樣
const items = [];
for (const arg of process.argv.slice(3)) {
  if (arg.trim()) {
    items.push(arg.trim());
  }
}
let notes = '';
if (items.length === 1) {
  notes = items[0];
}
if (items.length > 1) {
  const lines = [];
  for (const item of items) {
    lines.push('- ' + item);
  }
  notes = lines.join('\n');
}

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail('版本號格式要像 0.0.2，用法：npm run desktop:release 0.0.2 "這版改了什麼"');
}
if (!notes) {
  fail('要寫這版改了什麼，會顯示在 APP 的更新提示裡');
}

// 新版本要比現在的大，APP 才會判斷成有更新
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
const current = conf.version;
const a = current.split('.').map(Number);
const b = version.split('.').map(Number);
let newer = false;
for (let i = 0; i < 3; i++) {
  if (b[i] > a[i]) {
    newer = true;
    break;
  }
  if (b[i] < a[i]) {
    break;
  }
}
if (!newer) {
  fail(`新版本 ${version} 要比現在的 ${current} 大`);
}

const tag = 'desktop-v' + version;
if (git(['tag', '-l', tag])) {
  fail(`tag ${tag} 已經存在`);
}

// 除了本機的 .env，其他改動要先 commit，避免發出去的版本少了東西
// 每行前兩碼是狀態，開頭可能是空白，所以不能整段 trim
const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
const dirty = [];
for (const line of status.split('\n')) {
  if (!line.trim()) {
    continue;
  }
  const file = line.slice(3);
  if (file !== '.env') {
    dirty.push(file);
  }
}
if (dirty.length > 0) {
  fail('還有沒 commit 的改動，先 commit 再發版：\n  ' + dirty.join('\n  '));
}

// 三個地方的版本號，Cargo.lock 只改本專案那一筆
const confText = fs.readFileSync(confPath, 'utf8');
const newConf = confText.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`);

const cargoText = fs.readFileSync(cargoPath, 'utf8');
const newCargo = cargoText.replace(/^version = "[^"]*"/m, `version = "${version}"`);

const lockText = fs.readFileSync(lockPath, 'utf8');
const newLock = lockText.replace(/(name = "koatag"\r?\nversion = )"[^"]*"/, `$1"${version}"`);

if (newConf === confText || newCargo === cargoText || newLock === lockText) {
  fail('找不到要改的版本號，檔案格式可能變了');
}

fs.writeFileSync(confPath, newConf);
fs.writeFileSync(cargoPath, newCargo);
fs.writeFileSync(lockPath, newLock);
console.log(`[desktop-release] 版本 ${current} → ${version}`);

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);

gitShow(['add', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']);
gitShow(['commit', '-m', `chore(desktop): 發版 ${version}`]);
gitShow(['push', 'origin', branch]);
gitShow(['tag', '-a', tag, '-m', notes]);
gitShow(['push', 'origin', tag]);

console.log(`[desktop-release] ${tag} 已推上去，GitHub Actions 開始打包，完成後 APP 開啟時會提示更新`);
