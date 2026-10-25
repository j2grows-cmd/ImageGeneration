import { CreateMLCEngine } from "@mlc-ai/web-llm";

const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const $ = (id) => document.getElementById(id);

let engine = null;
let busy = false;
let history = [];
let systemPrompt = $("system-prompt").value;

function setStatus(message) {
  $("status").textContent = message;
}

function addMessage(role, content) {
  const empty = document.querySelector(".empty-state");
  if (empty) empty.remove();

  const item = document.createElement("article");
  item.className = `message ${role}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "AI";
  const body = document.createElement("div");
  body.textContent = content;
  item.append(label, body);
  $("messages").appendChild(item);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function checkCapabilities() {
  const badge = $("gpu-badge");
  if (!window.isSecureContext) {
    badge.textContent = "Secure context required";
    setStatus("Open this page over HTTPS. Browser GPU APIs are not available in every context.");
    $("load-model").disabled = true;
    return false;
  }
  if (!navigator.gpu) {
    badge.textContent = "WebGPU unavailable";
    setStatus("This browser does not expose WebGPU. Local text generation cannot start here. Try an up-to-date browser/device that supports WebGPU; this app does not send prompts to a remote inference API.");
    $("load-model").disabled = true;
    return false;
  }
  badge.textContent = "WebGPU available";
  setStatus("WebGPU detected. Load the model to begin; the first download may be large.");
  return true;
}

$("temperature").addEventListener("input", () => {
  $("temperature-value").value = $("temperature").value;
  $("temperature-value").textContent = $("temperature").value;
});

$("load-model").addEventListener("click", async () => {
  if (busy || engine) return;
  if (!checkCapabilities()) return;

  busy = true;
  $("load-model").disabled = true;
  $("load-progress").hidden = false;
  setStatus("Loading model and downloading required files…");

  try {
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        if (progress?.text) setStatus(progress.text);
        if (typeof progress?.progress === "number") {
          $("load-progress").value = Math.round(progress.progress * 100);
        }
      },
    });
    setStatus("Model ready. Text generation runs locally in this browser.");
    $("send").disabled = false;
    $("load-model").textContent = "Model loaded";
  } catch (error) {
    console.error(error);
    engine = null;
    $("load-model").disabled = false;
    setStatus(`Could not load model: ${error?.message || "unknown error"}. Check WebGPU support, free memory and the browser console.`);
  } finally {
    busy = false;
  }
});

$("send").addEventListener("click", async () => {
  const input = $("user-prompt");
  const content = input.value.trim();
  if (!engine || !content || busy) return;

  busy = true;
  $("send").disabled = true;
  input.value = "";
  systemPrompt = $("system-prompt").value.trim();
  history.push({ role: "user", content });
  addMessage("user", content);
  setStatus("Generating locally…");

  try {
    const messages = [
      { role: "system", content: systemPrompt || "You are a helpful assistant." },
      ...history,
    ];
    const result = await engine.chat.completions.create({
      messages,
      temperature: Number($("temperature").value),
      max_tokens: Number($("max-tokens").value),
    });
    const answer = result.choices?.[0]?.message?.content ?? "";
    history.push({ role: "assistant", content: answer });
    addMessage("assistant", answer || "(The model returned an empty response.)");
    setStatus("Ready.");
  } catch (error) {
    console.error(error);
    history.pop();
    setStatus(`Generation failed: ${error?.message || "unknown error"}`);
  } finally {
    busy = false;
    $("send").disabled = !engine;
    input.focus();
  }
});

$("user-prompt").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("send").click();
  }
});

$("clear-chat").addEventListener("click", () => {
  history = [];
  $("messages").replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = "Conversation cleared. Your system instructions are unchanged.";
  $("messages").appendChild(empty);
});

checkCapabilities();
