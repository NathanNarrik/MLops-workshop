// These hand-authored shapes are regression fixtures, not a handwriting benchmark.
// Exercise real pointer events, browser preprocessing, the API, and rendered output.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const strokes = JSON.parse(await fs.readFile(new URL('./strokes.json', import.meta.url)));
const baseURL = process.env.APP_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let requests = 0;
page.on('request', request => { if (new URL(request.url()).pathname === '/predict') requests++; });

async function draw(paths, scale = 1, dx = 0, dy = 0) {
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#canvas').boundingBox();
  for (const path of paths) {
    const points = path.map(([x,y]) => [box.x + (140+(x-140)*scale+dx)*box.width/280,
      box.y + (140+(y-140)*scale+dy)*box.height/280]);
    await page.mouse.move(...points[0]);
    await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(...point, {steps: 2});
    await page.mouse.up();
  }
}

async function predict(expected) {
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/predict');
  await page.locator('#predict').click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const result = await response.json();
  const pixels = response.request().postDataJSON().pixels;
  assert.equal(pixels.length, 64);
  assert(pixels.every(v => Number.isInteger(v) && v >= 0 && v <= 16));
  // Preview must show the payload, not a separate approximation.
  const preview = await page.locator('#input-preview').evaluate(canvas =>
    Array.from(canvas.getContext('2d').getImageData(0,0,8,8).data)
      .filter((_, i) => i % 4 === 0).map(v => Math.round(v / 255 * 16)));
  assert.deepEqual(preview, pixels);
  assert.equal(result.digit, expected);
  assert.equal(result.digit, result.probabilities.indexOf(Math.max(...result.probabilities)));
  await page.waitForFunction(digit => document.getElementById('digit').textContent === String(digit), expected);
  await page.waitForFunction(() => !document.getElementById('predict').disabled);
  return pixels;
}

try {
  await page.goto(baseURL);
  await page.getByText('API ready', {exact: true}).waitFor();
  await page.locator('#predict').click();
  assert.match(await page.locator('#message').innerText(), /Draw a digit/);
  assert.equal(requests, 0, 'blank canvas should not reach the model');
  for (const [variant, scale, dx, dy] of [['large',1,0,0], ['small',.6,0,0], ['offset',.75,-35,20]]) {
    for (const [digit, paths] of Object.entries(strokes)) {
      await page.locator('#clear').click();
      await draw(paths, scale, dx, dy);
      await predict(Number(digit));
    }
    console.log(`PASS: digits 0–9, ${variant}`);
  }
  const samples = await (await page.request.get(new URL('/samples', baseURL).href)).json();
  await page.locator('#sample').selectOption('3');
  assert.deepEqual(await predict(3), samples[3].pixels);
  // Starting a drawing must erase the selected example before adding ink.
  await draw(strokes['7']);
  assert.equal(await page.locator('#sample').inputValue(), '');
  const afterSample = await predict(7);
  await page.locator('#clear').click();
  await draw(strokes['7']);
  assert.deepEqual(await predict(7), afterSample);
  await page.setViewportSize({width: 390, height: 844});
  for (const digit of [1, 6, 7]) {
    await page.locator('#clear').click();
    await draw(strokes[digit], .6, 25, -10);
    await predict(digit);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: blank guard, exact preview, sample bypass, sample-to-drawing reset, mobile 1/6/7, no JS errors');
} finally {
  await browser.close();
}
