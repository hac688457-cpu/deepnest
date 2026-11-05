// Visual regression for the full CNC export menu in packaged Electron.
// Run on an isolated X server: DISPLAY=:160 DEEPNEST_APP=/absolute/app node tests/electron-export-menu.cjs
const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = process.env.DEEPNEST_APP;
assert(appPath && path.isAbsolute(appPath), 'Set DEEPNEST_APP to an absolute packaged executable');
const root = process.env.DEEPNEST_TEST_ROOT || '/tmp/deepnest-cnc-export-menu-test';
for (const name of ['home', 'config', 'cache']) {
  fs.mkdirSync(path.join(root, name), { recursive: true });
}
const env = {
  ...process.env,
  HOME: path.join(root, 'home'),
  XDG_CONFIG_HOME: path.join(root, 'config'),
  XDG_CACHE_HOME: path.join(root, 'cache'),
  XDG_SESSION_TYPE: 'x11',
  WAYLAND_DISPLAY: ''
};

(async () => {
  let app;
  try {
    app = await _electron.launch({
      executablePath: appPath,
      args: [],
      env,
      timeout: 30000
    });
    const page = await app.firstWindow();
    await page.waitForSelector('#export_wrapper');
    await page.evaluate(() => {
      document.querySelector('#nest').classList.add('active');
      document.querySelector('#main').classList.remove('active');
      document.querySelector('#export_wrapper').classList.add('active');
    });
    await page.locator('#export').hover();
    await page.waitForTimeout(250); // opacity transition

    const result = await page.evaluate(() => {
      const menu = document.querySelector('#export_wrapper ul.dropdown');
      const items = [...menu.querySelectorAll('li')];
      const mr = menu.getBoundingClientRect();
      const style = getComputedStyle(menu);
      return {
        opacity: Number(style.opacity),
        visibility: style.visibility,
        menu: { left: mr.left, top: mr.top, right: mr.right, bottom: mr.bottom, width: mr.width },
        items: items.map(el => {
          const rect = el.getBoundingClientRect();
          const atCenter = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {
            id: el.id,
            left: rect.left, right: rect.right,
            top: rect.top, bottom: rect.bottom,
            textWidth: el.scrollWidth,
            width: el.clientWidth,
            clickableAtCenter: el === atCenter || el.contains(atCenter)
          };
        }),
        viewport: { width: innerWidth, height: innerHeight }
      };
    });
    assert.equal(result.items.length, 5);
    assert.equal(result.visibility, 'visible');
    assert(result.opacity > 0.95);
    assert(result.menu.width >= 300, 'Menu must expand beyond the Export button');
    assert(result.menu.bottom < result.viewport.height, 'Menu must fit into window');
    for (const item of result.items) {
      assert(item.top >= result.menu.top - 1 && item.bottom <= result.menu.bottom + 1, item.id + ' clipped vertically');
      assert(item.left >= result.menu.left - 1 && item.right <= result.menu.right + 1, item.id + ' clipped horizontally');
      assert(item.right <= result.viewport.width, item.id + ' outside window');
      assert(item.textWidth <= item.width + 1, item.id + ' label clipped');
      assert(item.clickableAtCenter, item.id + ' covered by another element');
    }

    // Prove the exact per-sheet option receives a real pointer event without opening a file dialog.
    await page.evaluate(() => {
      window.__sheetOptionClicked = false;
      document.querySelector('#exportcncdxfsheets').addEventListener('click', e => {
        window.__sheetOptionClicked = true;
        e.preventDefault();
        e.stopImmediatePropagation();
      }, { capture: true, once: true });
    });
    await page.locator('#exportcncdxfsheets').click();
    assert.equal(await page.evaluate(() => window.__sheetOptionClicked), true);
    await page.screenshot({ path: path.join(root, 'export-menu.png') });
    console.log('EXPORT_MENU_ALL_5_VISIBLE_AND_SHEET_OPTION_CLICKABLE', JSON.stringify(result.menu));
  } finally {
    if (app) await app.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
