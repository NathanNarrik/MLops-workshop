import { drawingPixels } from "/static/preprocess.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
let samples = [],
  selectedPixels = null,
  drawing = false;
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
  } catch {
    $("status").textContent = "API offline";
    $("refresh-status").textContent = "Connection lost · retrying";
  }
}
async function experiment(mode) {
  const buttons = ["normal", "shifted", "invalid"];
  buttons.forEach((id) => ($(id).disabled = true));
  const count = mode === "invalid" ? 1 : 30;
  try {
    for (let i = 0; i < count; i++) {
      let input = samples[i % samples.length].pixels;
      if (mode === "shifted") input = input.map((v) => Math.min(16, v + 8));
      if (mode === "invalid") input = [99];
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
        ? "HTTP 422: input rejected. The error rate increased."
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
