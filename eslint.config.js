// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// 分層規則（詳見 .claude/skills/expo-app-architect/SKILL.md）：
//   src/app → src/features → src/components → src/lib，只能往右依賴，不能反過來
// 只比對 firebase 套件本身；src/lib/firebase.ts 自己的匯出（例如 ensureSignedIn）可以正常使用
const FIREBASE = {
  regex: '^firebase(/|$)',
  message: 'Firebase 只能在 src/lib/repo.ts、firebase*.ts 使用；其他地方請呼叫 repo 的函式。',
};
const FEATURES = {
  group: ['@/features/*', '**/features/*'],
  message: 'src/components 與 src/lib 是共用層，不能依賴功能模組（src/features）。',
};
const COMPONENTS = {
  group: ['@/components/*', '**/components/*'],
  message: 'src/lib 是最底層，不能依賴 UI 元件。',
};
const BOARD = {
  group: ['@/features/board/*'],
  message: '白板（board）是主畫面，其他功能不能反過來依賴它。',
};
const restrict = (...patterns) => ['error', { patterns }];
const FIREBASE_FILES = ['src/lib/repo.ts', 'src/lib/firebase.ts', 'src/lib/firebase-auth.ts', 'src/lib/firebase-auth.native.ts'];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // 同一個檔案符合多組設定時，後面的會蓋掉前面的，所以每組都列出完整的限制
  { files: ['src/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict(FIREBASE) } },
  { files: ['src/features/{alerts,pet,setup,widgets}/**'], rules: { 'no-restricted-imports': restrict(FIREBASE, BOARD) } },
  { files: ['src/components/**'], rules: { 'no-restricted-imports': restrict(FIREBASE, FEATURES) } },
  { files: ['src/lib/**'], rules: { 'no-restricted-imports': restrict(FIREBASE, FEATURES, COMPONENTS) } },
  { files: FIREBASE_FILES, rules: { 'no-restricted-imports': restrict(FEATURES, COMPONENTS) } },
]);
