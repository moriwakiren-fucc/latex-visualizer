import { MetaPost } from "./vendor/mp-tikz-wasm/index.js";

const $ = (id) => document.getElementById(id);
const source = $("source");
const compileBtn = $("compileBtn");
const engineState = $("engineState");
const statusBox = $("compileStatus");
const logOutput = $("logOutput");
const pdfFrame = $("pdfFrame");
const emptyState = $("emptyState");
let enginePromise = null;
let currentPdfUrl = null;
let lastPdf = null;
const sample = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}

\begin{document}
\begin{tikzpicture}
  \begin{axis}[
      axis lines = middle,
      xlabel = {$x$},
      ylabel = {$y$},
      xmin = -0.5, xmax = 1.5,
      ymin = -0.5, ymax = 3.0,
      xtick = {1},
      ytick = {1},
      extra y ticks = {2.718},
      extra y tick labels = {$e$},
      grid = none,
      axis on top
    ]

    % 1. 領域の塗りつぶし (0 <= x <= 1, 0 <= y <= e^x)
    \addplot [fill=blue!20, draw=none, domain=0:1] {exp(x)} -- (axis cs:1,0) -- (axis cs:0,0) -- cycle;

    % 2. 境界線の描画
    \addplot [domain=0:1, thick, blue] {exp(x)};
    \draw [thick, blue] (axis cs:0,0) -- (axis cs:1,0);

    % 3. x = 1 の境界線（破線）
    \draw [dashed, red, thick] (axis cs:1,0) -- (axis cs:1,2.718);

    % 4. 端点（白抜き）
    \draw [red, fill=white, thick] (axis cs:1,2.718) circle (2pt);
    \draw [red, fill=white, thick] (axis cs:1,0) circle (2pt);
    \draw [black, fill=white, thick] (axis cs:0,0) circle (2pt);

  \end{axis}
\end{tikzpicture}
\end{document}
`;

function setStatus(kind, message) {
  statusBox.className = "compile-status " + kind;
  statusBox.lastElementChild.textContent = message;
}
function log(message, append = true) {
  if (!append) logOutput.textContent = "";
  logOutput.textContent += (logOutput.textContent ? "\n" : "") + message;
  logOutput.scrollTop = logOutput.scrollHeight;
}
function updateEditorMeta() {
  const lines = source.value.split("\n").length;
  $("lineNumbers").textContent = Array.from({length:lines},(_,i)=>i+1).join("\n");
  $("charCount").textContent = `${source.value.length.toLocaleString("ja-JP")} 文字`;
}
function getEngine() {
  if (!enginePromise) {
    engineState.className = "engine-state busy";
    engineState.innerHTML = "<i></i> エンジン読み込み中";
    enginePromise = MetaPost.create({ logLevel: "warn" });
  }
  return enginePromise;
}
function formatDiagnostics(items = []) {
  return items.map(d => {
    const loc = [d.file, d.line ? `行 ${d.line}` : ""].filter(Boolean).join(":");
    return `[${String(d.severity || "info").toUpperCase()}] ${loc ? loc + " — " : ""}${d.message || ""}`;
  }).join("\n");
}
async function compile() {
  const tex = source.value;
  if (!tex.trim()) {
    setStatus("error", "LaTeXコードを入力してください。");
    return;
  }
  compileBtn.disabled = true;
  compileBtn.textContent = "コンパイル中…";
  engineState.className = "engine-state busy";
  engineState.innerHTML = "<i></i> コンパイル中";
  setStatus("busy", "WebAssemblyエンジンでコンパイルしています…");
  log("コンパイルを開始します。", false);
  const started = performance.now();
  try {
    const engine = await getEngine();
    log("ブラウザ内LaTeXエンジンの準備ができました。");
    const result = await engine.latex(tex, { output: "pdf" });
    const diagnostics = formatDiagnostics(result.diagnostics || []);
    if (diagnostics) log(diagnostics);
    if (!result.pdf || result.status === "error" || result.status === "fatal") {
      throw new Error(diagnostics || "PDFを生成できませんでした。");
    }
    lastPdf = new Blob([result.pdf], {type:"application/pdf"});
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = URL.createObjectURL(lastPdf);
    pdfFrame.src = currentPdfUrl;
    pdfFrame.hidden = false;
    emptyState.hidden = true;
    $("downloadPdf").disabled = false;
    const seconds = ((performance.now() - started) / 1000).toFixed(2);
    setStatus("ok", `コンパイル成功 — ${seconds} 秒`);
    engineState.className = "engine-state ready";
    engineState.innerHTML = "<i></i> エンジン準備完了";
    log(`\n完了：PDFを生成しました（${seconds} 秒）。`);
  } catch (error) {
    setStatus("error", "コンパイルに失敗しました。ログを確認してください。");
    engineState.className = "engine-state";
    engineState.innerHTML = "<i></i> エラー";
    log(`\n[COMPILE ERROR] ${error?.message || String(error)}`);
    console.error(error);
  } finally {
    compileBtn.disabled = false;
    compileBtn.innerHTML = "<span>▶</span> コンパイル";
  }
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
compileBtn.addEventListener("click", compile);
$("sampleBtn").addEventListener("click", () => { source.value = sample; updateEditorMeta(); });
$("clearBtn").addEventListener("click", () => { source.value = ""; updateEditorMeta(); });
$("clearLog").addEventListener("click", () => { logOutput.textContent = "ログを消去しました。"; });
$("downloadTex").addEventListener("click", () => downloadBlob(new Blob([source.value],{type:"application/x-tex;charset=utf-8"}),"main.tex"));
$("downloadPdf").addEventListener("click", () => { if (lastPdf) downloadBlob(lastPdf,"output.pdf"); });
source.addEventListener("input", updateEditorMeta);
source.addEventListener("scroll", () => { $("lineNumbers").scrollTop = source.scrollTop; });
source.addEventListener("keydown", e => {
  if (e.key === "Tab") {
    e.preventDefault();
    const a = source.selectionStart, b = source.selectionEnd;
    source.setRangeText("  ",a,b,"end");
    updateEditorMeta();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") compile();
});
source.value = sample;
updateEditorMeta();
