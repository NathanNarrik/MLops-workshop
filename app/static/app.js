import { drawingPixels } from "/static/preprocess.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
let samples = [],
  selectedPixels = null,
  drawing = false;
let requestHistory = [], inspectableHistory = [], inspectedId = null;

function paintImage(target, values = []) {
  const context = target.getContext("2d");
  for (let i = 0; i < 64; i++) {
    const value = values[i];
    const shade = value / 16 * 255;
    context.fillStyle = value === undefined ? "#3a64e4"
      : typeof value !== "number" || value < 0 || value > 16 ? "#ff4080"
      : `rgb(${shade},${shade},${shade})`;
    context.fillRect(i % 8, Math.floor(i / 8), 1, 1);
  }
}
function inspectRequest(entry) {
  if (!entry) return;
  $("request-select").value = entry.request_id;
  $("request-meta").textContent = `${entry.timestamp} · HTTP ${entry.status} · ${entry.latency_ms} ms · ID ${entry.request_id}`;
  paintImage($("request-image"), entry.request.pixels);
  // Keep each group of eight together so students can trace image rows to JSON.
  let requestJSON = JSON.stringify(entry.request, null, 2);
  if (Array.isArray(entry.request.pixels)) {
    const rows = [];
    for (let i = 0; i < entry.request.pixels.length; i += 8) {
      rows.push("    " + entry.request.pixels.slice(i, i + 8).map(v => JSON.stringify(v)).join(", "));
    }
    requestJSON = requestJSON.replace(/"pixels": \[[\s\S]*?\]/,
      '"pixels": [\n' + rows.join(",\n") + '\n  ]');
  }
  $("request-json").textContent = requestJSON;
  $("request-result").textContent = JSON.stringify(entry.response, null, 2);
}
$("request-select").addEventListener("change", (event) => {
  inspectedId = event.target.value;
  inspectRequest(inspectableHistory.find((entry) => entry.request_id === inspectedId));
});
function renderDrift() {
  let observed = 0, wrong = 0;
  const cards = samples.map((sample) => {
    const brighter = sample.pixels.map((v) => Math.min(16, v + 8));
    const entry = requestHistory.find((r) => r.status === 200 &&
      JSON.stringify(r.request.pixels) === JSON.stringify(brighter));
    const card = document.createElement("div");
    card.className = "drift-card";
    const title = document.createElement("p");
    title.textContent = `Known label: ${sample.label} · original → brighter`;
    const pair = document.createElement("div");
    pair.className = "drift-pair";
    [sample.pixels, brighter].forEach((values, i) => {
      const picture = document.createElement("canvas");
      picture.width = picture.height = 8;
      picture.setAttribute("aria-label", `${i ? "Brighter" : "Original"} digit ${sample.label}`);
      paintImage(picture, values);
      pair.append(picture);
    });
    const result = document.createElement("p");
    result.textContent = "Preview — not in recent requests yet";
    if (entry) {
      observed++;
      const incorrect = entry.response.digit !== sample.label;
      wrong += Number(incorrect);
      result.className = incorrect ? "alert" : "";
      result.textContent = `HTTP 200 · predicted ${entry.response.digit} · ${(entry.response.confidence * 100).toFixed(1)}% score · ${incorrect ? "WRONG" : "correct"}`;
      const inspect = document.createElement("button");
      inspect.className = "secondary";
      inspect.textContent = "Inspect request";
      inspect.onclick = () => {
        inspectedId = entry.request_id;
        inspectRequest(entry);
        $("inspector-title").scrollIntoView({behavior: "smooth"});
      };
      card.append(inspect);
    }
    card.prepend(title, pair, result);
    return card;
  });
  $("drift-examples").replaceChildren(...cards);
  $("drift-summary").textContent = observed
    ? `${wrong} of ${observed} distinct brighter examples were misclassified. All returned HTTP 200.`
    : "Preview only — brighter examples have not been sent yet.";
}
async function refreshJournal() {
  const history = await api("/requests");
  requestHistory = history.requests;
  // Errors stay inspectable even after 50 newer successful requests arrive.
  inspectableHistory = [...requestHistory, ...history.errors.filter((error) =>
    !requestHistory.some((entry) => entry.request_id === error.request_id))];
  $("request-select").replaceChildren(...inspectableHistory.map((entry) => {
    const option = document.createElement("option");
    option.value = entry.request_id;
    option.textContent = `${entry.timestamp.slice(11, 19)} UTC · HTTP ${entry.status} · ${entry.response.digit === undefined ? "Rejected / failed" : `digit ${entry.response.digit}`} · ${entry.request_id.slice(0, 8)}`;
    return option;
  }));
  inspectRequest(inspectableHistory.find((entry) => entry.request_id === inspectedId) || requestHistory[0]);
  $("error-log").replaceChildren(...history.errors.map((entry) => {
    const button = document.createElement("button");
    button.className = "secondary alert";
    const detail = (entry.response.detail || []).map((d) => `${d.loc.join(".")}: ${d.msg}`).join("; ");
    button.textContent = `${entry.timestamp} · HTTP ${entry.status} · ${detail || entry.response.message} · ID ${entry.request_id}`;
    button.onclick = () => { inspectedId = entry.request_id; inspectRequest(entry); };
    return button;
  }));
  if (!history.errors.length) $("error-log").textContent = "No errors recorded.";
  renderDrift();
}
function clear() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 280, 280);
  selectedPixels = null;
  $("sample").value = "";
  updatePreview(Array(64).fill(0));
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return [
    ((e.clientX - r.left) * 280) / r.width,
    ((e.clientY - r.top) * 280) / r.height,
  ];
}
canvas.addEventListener("pointerdown", (e) => {
  // Starting a drawing after a sample must not draw on top of the sample.
  if (selectedPixels) clear();
  drawing = true;
  selectedPixels = null;
  $("sample").value = "";
  canvas.setPointerCapture(e.pointerId);
  ctx.beginPath();
  ctx.moveTo(...point(e));
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 24;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineTo(...point(e));
  ctx.stroke();
});
canvas.addEventListener("pointermove", (e) => {
  if (drawing) {
    ctx.lineTo(...point(e));
    ctx.stroke();
  }
});
function finishDrawing() {
  drawing = false;
  updatePreview(pixels());
}
canvas.addEventListener("pointerup", finishDrawing);
canvas.addEventListener("pointercancel", finishDrawing);
$("clear").addEventListener("click", clear);
function pixels() {
  if (selectedPixels) return [...selectedPixels];
  return drawingPixels(canvas);
}
function updatePreview(values) {
  const preview = $("input-preview").getContext("2d");
  values.forEach((v, i) => {
    const shade = v / 16 * 255;
    preview.fillStyle = `rgb(${shade},${shade},${shade})`;
    preview.fillRect(i % 8, Math.floor(i / 8), 1, 1);
  });
}
async function api(path, body) {
  const options = body
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    : {};
  const response = await fetch(path, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(`HTTP ${response.status}`);
    e.status = response.status;
    e.data = data;
    throw e;
  }
  return data;
}
function bars(values = Array(10).fill(0)) {
  $("probabilities").replaceChildren(
    ...values.map((v, i) => {
      const column = document.createElement("div");
      column.className =
        "score" + (v === Math.max(...values) && v > 0 ? " best" : "");
      column.title = `${i}: ${(v * 100).toFixed(1)}%`;
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${v * 90 + 3}px`;
      const label = document.createElement("span");
      label.textContent = i;
      column.append(bar, label);
      return column;
    }),
  );
}
$("sample").addEventListener("change", (e) => {
  if (e.target.value === "") return;
  const sample = samples[Number(e.target.value)];
  clear();
  selectedPixels = [...sample.pixels];
  $("sample").value = e.target.value = String(samples.indexOf(sample));
  sample.pixels.forEach((v, i) => {
    ctx.fillStyle = `rgb(${(v / 16) * 255},${(v / 16) * 255},${(v / 16) * 255})`;
    ctx.fillRect((i % 8) * 35, Math.floor(i / 8) * 35, 35, 35);
  });
  updatePreview(selectedPixels);
});
$("predict").addEventListener("click", async () => {
  const input = pixels();
  updatePreview(input);
  if (input.every((v) => v === 0)) {
    $("message").textContent = "Draw a digit or choose an example first.";
    return;
  }
  $("predict").disabled = true;
  $("message").textContent = "Calling POST /predict…";
  try {
    const result = await api("/predict", { pixels: input });
    $("digit").textContent = result.digit;
    $("confidence").textContent =
      `${(result.confidence * 100).toFixed(1)}% model score`;
    $("response").textContent = JSON.stringify(result, null, 2);
    bars(result.probabilities);
    $("message").textContent =
      result.confidence < 0.8
        ? "The model is uncertain. Would you ask a user to confirm this prediction?"
        : "Does this match your digit? A confident prediction can still be wrong.";
    await refresh();
  } catch (e) {
    $("message").textContent =
      `Prediction failed: ${e.message}. Check the server terminal.`;
  } finally {
    $("predict").disabled = false;
  }
});
async function refresh() {
  try {
    const s = await api("/stats");
    $("requests").textContent = s.requests;
    $("errors").textContent = `${(s.error_rate * 100).toFixed(1)}%`;
    $("latency").textContent = `${s.p95_latency_ms.toFixed(1)} ms`;
    $("uncertain").textContent = s.low_confidence;
    $("shift-message").textContent =
      s.brightness_mean === null
        ? "Waiting for predictions."
        : `Recent mean ${s.brightness_mean.toFixed(2)} / training mean ${s.baseline_brightness_mean.toFixed(2)} · ${s.window_size} samples`;
    $("shift-status").textContent =
      s.window_size < 20
        ? "Collecting data"
        : s.input_shift_alert
          ? "Input shift detected"
          : "No brightness alert";
    $("shift-status").className = s.input_shift_alert ? "alert" : "";
    $("refresh-status").textContent = "Live · refreshes every 3 seconds";
    $("status").textContent = "API ready";
    $("version").textContent = s.model_version;
    await refreshJournal();
  } catch {
    $("status").textContent = "API offline";
    $("refresh-status").textContent = "Connection lost · retrying";
  }
}
async function experiment(mode) {
  inspectedId = null;
  const buttons = ["normal", "shifted", "invalid"];
  buttons.forEach((id) => ($(id).disabled = true));
  const count = mode === "invalid" ? 1 : 30;
  try {
    for (let i = 0; i < count; i++) {
      let input = samples[i % samples.length].pixels;
      if (mode === "shifted") input = input.map((v) => Math.min(16, v + 8));
      if (mode === "invalid") input = [99, ...input.slice(1)];
      try {
        await api("/predict", { pixels: input });
        if (mode === "invalid")
          throw new Error("Expected validation rejection");
      } catch (e) {
        if (mode !== "invalid" || e.status !== 422) throw e;
      }
      $("experiment-message").textContent =
        `${mode}: ${i + 1}/${count} requests`;
      await new Promise((r) => setTimeout(r, 100));
    }
    $("experiment-message").textContent =
      mode === "invalid"
        ? "HTTP 422: pixels[0] is 99 (maximum 16). Model did not run. See the request inspector and error log below."
        : `${count} ${mode} requests sent. Compare the monitoring numbers.`;
    await refresh();
  } catch (e) {
    $("experiment-message").textContent = `Experiment stopped: ${e.message}`;
  } finally {
    buttons.forEach((id) => ($(id).disabled = false));
  }
}
["normal", "shifted", "invalid"].forEach((id) =>
  $(id).addEventListener("click", () => experiment(id)),
);
async function init() {
  clear();
  bars();
  try {
    samples = await api("/samples");
    samples.forEach((s, i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `Digit ${s.label}`;
      $("sample").append(option);
    });
    await refresh();
  } catch {
    $("message").textContent =
      "Could not load examples. Start the API, then reload this page.";
  }
  setInterval(refresh, 3000);
}
init();
