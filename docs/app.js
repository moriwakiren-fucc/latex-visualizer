
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

// サンプル：TikZ + PGFPlots
const sample = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}

\begin{document}
\begin{tikzpicture}
  \begin{axis}[
    axis lines=middle,
    xlabel={$x$},
    ylabel={$y$},
    xmin=-0.5, xmax=1.5,
    ymin=-0.5, ymax=3,
    grid=major
  ]
    % 関数 y=e^x
    \addplot[
      domain=0:1,
      samples=100,
      thick,
      blue
    ] {exp(x)};

    % 領域の塗りつぶし
    \addplot[
      domain=0:1,
      samples=100,
      draw=none,
      fill=blue!20
    ] {exp(x)} \closedcycle;

    % 破線
    \draw[red,dashed,thick]
      (axis cs:1,0) -- (axis cs:1,2.718);

    % 白抜きの端点
    \draw[fill=white,thick]
      (axis cs:0,1) circle (2pt);
    \draw[fill=white,thick,red]
      (axis cs:1,2.718) circle (2pt);
  \end{axis}
\end{tikzpicture}
\end{document}
`;

function setStatus(type, message) {
  statusBox.className = "compile-status" + (type ? " " + type : "");
  statusBox.lastElementChild.textContent = message;
}

function log(message, clear = false) {
  if (clear) logOutput.textContent = "";

  logOutput.textContent +=
    (logOutput.textContent ? "\n" : "") + message;

  logOutput.scrollTop = logOutput.scrollHeight;
}

function setEngineState(type, message) {
  engineState.className =
    "engine-state" + (type ? " " + type : "");

  engineState.replaceChildren();

  const dot = document.createElement("i");
  engineState.append(dot, document.createTextNode(" " + message));
}

function updateEditorMeta() {
  const lines = source.value.split("\n").length;

  $("lineNumbers").textContent =
    Array.from({ length: lines }, (_, i) => i + 1).join("\n");

  $("charCount").textContent =
    `${source.value.length.toLocaleString("ja-JP")} 文字`;
}

// ========================================
// エンジン読み込み
// ========================================

async function getEngine() {
  if (!enginePromise) {
    setEngineState("busy", "エンジン読み込み中");
    log("LaTeXエンジンを読み込んでいます…");

    enginePromise = (async () => {
      const moduleUrl = new URL(
        "./vendor/mp-tikz-wasm/index.js",
        import.meta.url
      );

      const module = await import(moduleUrl.href);

      if (!module.MetaPost) {
        throw new Error(
          "MetaPost が見つかりません。エンジンの配置を確認してください。"
        );
      }

      const engine = await module.MetaPost.create({
        logLevel: "warn"
      });

      setEngineState("ready", "エンジン準備完了");
      log("エンジンの初期化が完了しました。");

      return engine;
    })().catch((error) => {
      // 失敗した場合は再試行できるようにする
      enginePromise = null;

      setEngineState("", "エンジン未起動");

      log(
        "エンジンの読み込みに失敗しました。\n" +
        (error.message || error) +
        "\n\nvendor/mp-tikz-wasm/ 内のファイル配置を確認してください。"
      );

      throw error;
    });
  }

  return enginePromise;
}

// ========================================
// コンパイル
// ========================================

async function compile() {
  const tex = source.value;

  if (!tex.trim()) {
    setStatus("error", "LaTeXコードを入力してください。");
    return;
  }

  compileBtn.disabled = true;
  compileBtn.textContent = "コンパイル中…";

  setStatus("busy", "コンパイルしています…");
  log("コンパイル開始", true);

  const start = performance.now();

  try {
    const engine = await getEngine();

    const result = await engine.latex(tex, {
      output: "pdf"
    });

    if (!result.pdf) {
      throw new Error(
        "PDFを生成できませんでした。\n" +
        JSON.stringify(result.diagnostics || [])
      );
    }

    const blob = new Blob(
      [result.pdf],
      { type: "application/pdf" }
    );

    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
    }

    currentPdfUrl = URL.createObjectURL(blob);
    lastPdf = blob;

    pdfFrame.src = currentPdfUrl;
    pdfFrame.hidden = false;
    emptyState.hidden = true;

    $("downloadPdf").disabled = false;

    const seconds =
      ((performance.now() - start) / 1000).toFixed(2);

    setStatus("ok", `コンパイル成功（${seconds}秒）`);
    log(`PDFを生成しました（${seconds}秒）。`);

  } catch (error) {
    setStatus("error", "コンパイルに失敗しました。");
    log("[ERROR] " + (error.message || error));

    console.error(error);

  } finally {
    compileBtn.disabled = false;
    compileBtn.innerHTML = "<span>▶</span> コンパイル";
  }
}

// ========================================
// ボタンのイベント登録
// ※エンジンの読み込みより先に登録する
// ========================================

// コンパイル
compileBtn.addEventListener("click", compile);

// サンプル
$("sampleBtn").addEventListener("click", () => {
  source.value = sample;

  updateEditorMeta();
  source.focus();

  setStatus("", "サンプルコードを読み込みました。");
});

// クリア
$("clearBtn").addEventListener("click", () => {
  source.value = "";

  updateEditorMeta();
  source.focus();

  setStatus("", "入力欄をクリアしました。");
});

// ログのクリア
$("clearLog").addEventListener("click", () => {
  logOutput.textContent = "ログを消去しました。";
});

// TeXファイルのダウンロード
$("downloadTex").addEventListener("click", () => {
  const blob = new Blob(
    [source.value],
    { type: "application/x-tex;charset=utf-8" }
  );

  downloadBlob(blob, "main.tex");
});

// PDFのダウンロード
$("downloadPdf").addEventListener("click", () => {
  if (lastPdf) {
    downloadBlob(lastPdf, "output.pdf");
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ========================================
// エディタ操作
// ========================================

source.addEventListener("input", updateEditorMeta);

source.addEventListener("scroll", () => {
  $("lineNumbers").scrollTop = source.scrollTop;
});

// Tabキーで空白を挿入
source.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();

    const start = source.selectionStart;
    const end = source.selectionEnd;

    source.setRangeText("  ", start, end, "end");

    updateEditorMeta();
  }

  // Ctrl + Enter / Cmd + Enter でコンパイル
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === "Enter"
  ) {
    compile();
  }
});

// ========================================
// 初期化
// ========================================

source.value = sample;
updateEditorMeta();

// エンジンの起動は最後に実行。
// 失敗してもボタン操作には影響しない。
getEngine().catch(() => {
  setStatus(
    "error",
    "エンジンを起動できません。ログを確認してください。"
  );
});
