import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(root, 'docs/ui-prototype-20261029');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) throw new Error('bad path');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: '/vol1/Docker/.playwright-admin/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell' });
const results = [];
try {
  for (const [name, width, height] of [['phone', 390, 844], ['ipad-mini-portrait', 744, 1133], ['ipad-mini-landscape', 1133, 744], ['pc', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`${base}/prototype/ui-responsive/`, { waitUntil: 'networkidle' });
    if (name === 'phone') {
      await page.evaluate(() => localStorage.removeItem('web-notes-ui-prototype-synthetic-v1'));
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.screenshot({ path: resolve(output, `after-${name}.png`), fullPage: false });
    const geometry = await page.evaluate(() => ({
      viewport: [innerWidth, innerHeight], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      list: Math.round(document.querySelector('.list-pane').getBoundingClientRect().width),
      editor: Math.round(document.querySelector('.editor-pane').getBoundingClientRect().width),
      bodyWidth: Math.round(document.querySelector('#body').getBoundingClientRect().width),
      editorVisible: getComputedStyle(document.querySelector('.editor-pane')).display !== 'none',
      titleHeight: Math.round(document.querySelector('#title').getBoundingClientRect().height),
      titleScroll: Math.round(document.querySelector('#title').scrollHeight),
      titleInlineHeight: document.querySelector('#title').style.height,
      titleClipped: document.querySelector('#title').scrollHeight > document.querySelector('#title').clientHeight + 1,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      touchControls: [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none').filter(b => b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0).every(b => b.getBoundingClientRect().height >= 40),
    }));
    results.push({ name, ...geometry });
    if (geometry.horizontalOverflow) throw new Error(`${name}: horizontal overflow`);
    if (geometry.titleHeight > 220) throw new Error(`${name}: long title input consumes excessive editor height`);
    if (geometry.titleClipped) throw new Error(`${name}: long title is clipped`);
    if (name === 'phone') {
      await page.keyboard.press('Tab');
      const focusRing = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2);
      if (!focusRing) throw new Error('keyboard focus indicator is missing');
      await page.locator('.state-picker summary').click();
      await page.getByRole('button', { name: 'Xung đột phiên' }).click();
      if (!(await page.locator('#status-text').textContent()).includes('Xung đột')) throw new Error('conflict fixture state not visible');
      await page.screenshot({ path: resolve(output, 'after-state-conflict.png'), fullPage: false });
      await page.locator('.state-picker summary').click();
      await page.getByRole('button', { name: 'Kho trống' }).click();
      if (await page.locator('#cards .note-card').count()) throw new Error('empty fixture still shows notes');
      await page.screenshot({ path: resolve(output, 'after-state-empty.png'), fullPage: false });
      await page.locator('.state-picker summary').click();
      await page.getByRole('button', { name: 'Bình thường' }).click();
      await page.getByRole('button', { name: '← Danh sách' }).click();
      await page.screenshot({ path: resolve(output, 'after-phone-list.png'), fullPage: false });
      await page.getByRole('searchbox', { name: 'Tìm ghi chú' }).fill('máy chủ');
      await page.getByRole('button', { name: /Mẫu cấu hình máy chủ/ }).click();
      await page.getByRole('textbox', { name: 'Nội dung ghi chú' }).fill('Bản nháp tổng hợp mới.');
      await page.waitForFunction(() => document.querySelector('#save-state').textContent === 'Đã đồng bộ');
      if (!(await page.getByRole('status').first().isVisible())) throw new Error('missing save status');
      await page.locator('#history-button').click();
      if (!(await page.getByText('Lịch sử gần đây').isVisible())) throw new Error('history panel did not open');
      await page.locator('#share-button').click();
      await page.getByRole('button', { name: 'Ngừng chia sẻ' }).click();
      await page.getByRole('button', { name: '← Danh sách' }).click();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '← Danh sách' }).click();
      await page.getByRole('searchbox', { name: 'Tìm ghi chú' }).fill('máy chủ');
      await page.getByRole('button', { name: /Mẫu cấu hình máy chủ/ }).click();
      const reloadedBody = await page.locator('#body').inputValue();
      if (!reloadedBody.includes('Bản nháp tổng hợp mới.')) throw new Error(`local synthetic draft was not retained after reload (${reloadedBody.slice(0,80)})`);
      await page.getByRole('button', { name: '← Danh sách' }).click();
      await page.locator('#new-note-mobile').click();
      await page.locator('#title').fill('Ghi chú mới tổng hợp');
      await page.locator('#body').fill('con trỏ thử');
      await page.locator('#body').evaluate(el => el.setSelectionRange(5, 5));
      await page.setViewportSize({ width: 744, height: 1133 });
      await page.setViewportSize({ width: 390, height: 844 });
      if (await page.locator('#title').inputValue() !== 'Ghi chú mới tổng hợp') throw new Error('draft lost during responsive resize');
      if (await page.locator('#body').evaluate(el => el.selectionStart) !== 5) throw new Error('caret moved during responsive resize');
      await page.getByRole('button', { name: /Danh sách/ }).click();
      await page.keyboard.press('Control+k');
      if (!(await page.locator('#search').evaluate(el => el === document.activeElement))) throw new Error('keyboard search shortcut failed');
      await page.getByRole('button', { name: 'Mở thư mục' }).click();
      if (!(await page.locator('.folders').evaluate(el => getComputedStyle(el).display !== 'none'))) throw new Error('mobile folder drawer did not open');
      await page.getByRole('button', { name: 'Tất cả ghi chú' }).click();
      await page.locator('#select-mode').click();
      await page.locator('.note-card').first().click();
      await page.locator('#bulk-trash').click();
      await page.locator('#nav-trash').click();
      await page.locator('#restore-trash').click();
      if (await page.locator('#note-count').textContent() !== '1 ghi chú') throw new Error('trash restore did not restore synthetic note');
      await page.screenshot({ path: resolve(output, 'after-phone-interactions.png'), fullPage: false });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (await page.locator('#toast').evaluate(el => getComputedStyle(el).transitionDuration) !== '0s') throw new Error('reduced motion preference was not applied');
    }
    await page.close();
  }
  const tablet = await browser.newPage({ viewport: { width: 744, height: 1133 }, deviceScaleFactor: 1 });
  await tablet.goto(`${base}/prototype/ui-responsive/?layout=single`, { waitUntil: 'networkidle' });
  const ipadSinglePane = await tablet.locator('#body').evaluate(el => Math.round(el.getBoundingClientRect().width));
  await tablet.screenshot({ path: resolve(output, 'after-ipad-mini-portrait-single-editor.png'), fullPage: false });
  await tablet.getByRole('button', { name: '← Danh sách' }).click();
  await tablet.screenshot({ path: resolve(output, 'after-ipad-mini-portrait-single-list.png'), fullPage: false });
  await tablet.locator('.note-card').first().click();
  const ipadSingleReopen = await tablet.locator('#body').evaluate(el => Math.round(el.getBoundingClientRect().width));
  if (ipadSinglePane !== ipadSingleReopen) throw new Error('single-pane editor width changed during list/editor navigation');
  await tablet.close();
  const css = await readFile(resolve(root, 'public/app.css'), 'utf8');
  const baseline = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n.demo{position:fixed;top:0;right:0;background:#f7e8c3;padding:4px 8px;font:11px system-ui;z-index:99}.demo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:9px}.demo-card{aspect-ratio:1;max-height:240px;padding:11px;overflow:hidden;background:#fffef8}.demo-card strong,.demo-card p{display:block;overflow:hidden;overflow-wrap:anywhere;white-space:pre-wrap}</style></head><body><div class="demo">BASELINE · fixture tổng hợp · CSS/source hiện hành</div><main><header><h1>Notes</h1><p>Ghi chú, checklist và thư mục</p></header><div class="toolbar"><button>Note mới</button><button>Chọn nhiều</button><button>Tải backup</button></div><div class="layout"><aside><label>Tìm trong tiêu đề và đoạn xem trước</label><input placeholder="Tìm kiếm"><button>Công việc</button><button>Ý tưởng</button><button>Cá nhân</button><button>Thùng rác</button></aside><section><h2>Tất cả ghi chú</h2><div class="demo-grid">${['Kế hoạch tuần · tiêu đề dài để kiểm tra|Ưu tiên hoàn thiện bản trình bày, gom phản hồi và chuẩn bị nội dung cho buổi trao đổi thứ Sáu.|Công việc','Ghi chú cuộc họp nhóm|Quyết định, việc tiếp theo và nội dung checklist.|Công việc','Mẫu cấu hình máy chủ|export const options = { retries: 3, mode: readonly };|Dự án dài hạn','Ý tưởng hộp thư nhanh|Một nơi nhận các mẩu nội dung rồi phân loại sau.|Ý tưởng','Danh sách đọc cuối tuần|Bài viết về thiết kế thông tin và vài cuốn sách.|Cá nhân','Lộ trình dự án|Giai đoạn một, hai và ba.|Dự án dài hạn','Bữa tối cuối tuần|Rau củ, mì và gia vị.|Cá nhân','Ghi nhanh ý tưởng|Một dòng ý tưởng ngắn để kiểm tra mật độ.|Ý tưởng'].map(s=>{const [t,p,f]=s.split('|');return `<button class="demo-card"><strong>${t}</strong><p>${p}</p><small>${f}</small></button>`}).join('')}</div></section></div><section><h2>Soạn ghi chú</h2><label>Tiêu đề</label><input value="Kế hoạch tuần · tiêu đề dài để kiểm tra"><label>Nội dung</label><textarea rows="8">Ưu tiên hoàn thiện bản trình bày, gom phản hồi và chuẩn bị nội dung cho buổi trao đổi thứ Sáu.\n\nChecklist:\n☐ Rà soát các mục đang mở\n☐ Gửi bản nháp cho nhóm</textarea><button>Lưu ngay</button><button>Chia sẻ</button></section></main></body></html>`;
  for (const [name, width, height] of [['phone', 390, 844], ['ipad-mini-portrait', 744, 1133], ['ipad-mini-landscape', 1133, 744], ['pc', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(baseline, { waitUntil: 'load' });
    await page.screenshot({ path: resolve(output, `before-${name}.png`), fullPage: false });
    await page.close();
  }
  const portraitSplit = results.find(row => row.name === 'ipad-mini-portrait');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(resolve(output, 'browser-results.json'), JSON.stringify({ browser: 'Chromium headless, NAS arm64, emulated CSS viewports', viewports: results, ipadPortraitComparison: { viewport: '744x1133 CSS px', twoPane: { pane: 'folders + list + editor', editorPaneWidth: portraitSplit.editor, editableBodyWidth: portraitSplit.bodyWidth }, onePane: { pane: 'list/editor switch, folders in drawer', editorPaneWidth: 744, editableBodyWidth: ipadSinglePane } }, interactions: ['synthetic draft persisted across reload', 'search and open', 'history and share revoke', 'new note', 'viewport resize preserves text and caret', 'multi-select and move/trash/restore', 'keyboard search shortcut and focus ring', 'folder drawer', 'empty/conflict scenarios', 'reduced motion'], network: 'none; no API/backend requests' }, null, 2) + '\n'));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
