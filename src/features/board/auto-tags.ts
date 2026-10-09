import { plainText } from '@/lib/rich-text';
import { MAX_TAGS, normalizeTag } from '@/lib/types';

/** 內容裡出現這些字，就自動貼上對應的標籤 */
const RULES: [string, RegExp][] = [
  ['家事', /打掃|掃地|拖地|洗碗|洗衣|曬衣|晾衣|摺衣|倒垃圾|垃圾車|資源回收|大掃除|換床單|澆花/],
  ['採買', /買|採買|超市|全聯|家樂福|好市多|costco|賣場|補貨|團購/i],
  ['學校', /學校|老師|作業|聯絡簿|家長會|考試|月考|段考|開學|放學|補習|幼兒園|安親|校外教學|畢業/],
  ['繳費', /繳|帳單|電費|水費|瓦斯|管理費|學費|保費|稅金|信用卡|房租|網路費|電話費|度數/],
  ['出遊', /出遊|旅行|旅遊|露營|野餐|爬山|登山|飯店|民宿|機票|訂房|景點|遊樂園/],
  ['看醫生', /醫生|看診|掛號|診所|醫院|牙醫|疫苗|回診|拿藥|健檢/],
  ['聚餐', /聚餐|餐廳|訂位|慶生|聚會|吃大餐/],
];

/**
 * 依內容（含待辦項目）猜標籤：白板上已經有人用過的標籤直接出現在內容裡的優先，再來是常見關鍵字。
 * known = 白板上大家用過的標籤
 */
export function suggestTags(text: string, known: string[]): string[] {
  const plain = plainText(text);
  const found = [
    ...known.filter((tag) => tag.length >= 2 && plain.includes(tag)),
    ...RULES.filter(([, re]) => re.test(plain)).map(([tag]) => tag),
  ].map(normalizeTag);
  return [...new Set(found)].filter(Boolean);
}

/**
 * 自動標籤：原本的標籤 + 內容新出現的。編輯舊的項目時只加「這次改內容才多出來的」，
 * 之前自己拿掉的標籤不會因為重新打開就又被加回去
 */
export function withAutoTags(tags: string[], text: string, initialText: string | null, known: string[]) {
  const before = initialText === null ? [] : suggestTags(initialText, known);
  const added = suggestTags(text, known).filter((t) => !before.includes(t) && !tags.includes(t));
  return [...tags, ...added].slice(0, MAX_TAGS);
}
