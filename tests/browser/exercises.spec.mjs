// Verify the teaching story across CLI -> API -> journal -> browser pixels/JSON.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: {width: 1440, height: 1200} });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const get = async path => (await page.request.get(`${baseURL}${path}`)).json();
try {
  await page.goto(baseURL);
  await page.getByText('API ready', {exact: true}).waitFor();
  assert.equal(await page.getByRole('link', {name: 'Stats JSON'}).getAttribute('href'), '/stats');
  const before = await get('/stats');
  const output = execFileSync(process.env.PYTHON_EXE || 'python',
    ['scripts/traffic.py', '--url', baseURL, '--mode', 'invalid', '--count', '1'],
    {encoding: 'utf8'});
  assert.match(output, /Original image/);
  assert.match(output, /"pixels": \[99/);
  assert.match(output, /HTTP 422/);
  assert.match(output, /"model_ran": false/);
  const entry = (await get('/requests')).errors[0];
  assert(output.includes(entry.request_id));
  await page.waitForFunction(id => document.querySelector('#error-log').textContent.includes(id), entry.request_id);
  await page.locator('#error-log button').first().click();
  assert.deepEqual(JSON.parse(await page.locator('#request-json').innerText()), entry.request);
  assert.deepEqual(JSON.parse(await page.locator('#request-result').innerText()), entry.response);
  assert.deepEqual(await page.locator('#request-image').evaluate(canvas =>
    Array.from(canvas.getContext('2d').getImageData(0,0,1,1).data)), [255,64,128,255]);
  assert.equal((await get('/stats')).predictions, before.predictions);

  await page.locator('#shifted').click();
  await page.waitForFunction(() => !document.getElementById('shifted').disabled);
  await page.waitForFunction(() => document.querySelectorAll('.drift-card .alert').length > 0);
  const samples = await get('/samples');
  const history = (await get('/requests')).requests;
  const cards = page.locator('.drift-card');
  assert.equal(await cards.count(), 10);
  let wrong = 0;
  for (let i = 0; i < samples.length; i++) {
    const pixels = samples[i].pixels.map(v => Math.min(16, v + 8));
    const sent = history.find(r => JSON.stringify(r.request.pixels) === JSON.stringify(pixels));
    assert(sent);
    const text = await cards.nth(i).innerText();
    assert(text.includes(`HTTP 200 · predicted ${sent.response.digit}`));
    wrong += Number(sent.response.digit !== samples[i].label);
    assert.deepEqual(await cards.nth(i).locator('canvas').nth(1).evaluate(canvas =>
      Array.from(canvas.getContext('2d').getImageData(0,0,8,8).data)
        .filter((_, i) => i % 4 === 0).map(v => Math.round(v / 255 * 16))), pixels);
  }
  assert.match(await page.locator('#drift-summary').innerText(), new RegExp(`${wrong} of 10`));
  await cards.first().getByRole('button').click();
  assert.deepEqual(JSON.parse(await page.locator('#request-json').innerText()).pixels,
    samples[0].pixels.map(v => Math.min(16, v + 8)));

  if (process.env.SCREENSHOT_DIR) {
    await page.locator('section[aria-labelledby="inspector-title"]').screenshot({path: `${process.env.SCREENSHOT_DIR}/request-inspector.png`});
    await page.locator('section[aria-labelledby="drift-title"]').screenshot({path: `${process.env.SCREENSHOT_DIR}/drift-gallery.png`});
  }
  // Old errors must remain selectable after they leave the 50-request history.
  for (let i = 0; i < 51; i++) await page.request.post(`${baseURL}/predict`, {data: {pixels: samples[i % 10].pixels}});
  await page.waitForFunction(() => document.querySelector('#drift-summary').textContent.includes('Preview only'));
  await page.locator('#error-log button').first().click();
  await page.waitForResponse(r => new URL(r.url()).pathname === '/requests');
  await page.waitForTimeout(100);
  assert.equal(JSON.parse(await page.locator('#request-result').innerText()).request_id, entry.request_id);
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.SCREENSHOT_DIR) await page.locator('section[aria-labelledby="inspector-title"]').screenshot({path: `${process.env.SCREENSHOT_DIR}/request-mobile.png`});
  assert.deepEqual(errors, []);
  console.log(`PASS: CLI images/JSON, correlated error log, exact brighter images, ${wrong}/10 actual mistakes, retained errors, mobile layout`);
} finally {
  await browser.close();
}
