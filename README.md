# TeX Studio — GitHub Pages（Deploy from a branch）

## 公開方法

この構成は GitHub Pages の **Deploy from a branch** を使います。GitHub Actions は不要です。

1. ZIPを解凍します。
2. 中の `docs/` フォルダをGitHubリポジトリの直下に置きます。
3. `docs/` にLaTeXエンジンの配布ファイルを配置します（下記参照）。
4. GitHubの **Settings → Pages** を開きます。
5. **Build and deployment → Source** を `Deploy from a branch` にします。
6. Branchを `main`、Folderを `/docs` にして **Save** します。

## LaTeXエンジンの配置（初回のみ）

ブラウザ内コンパイルに使う mp-tikz-wasm の配布物が必要です。配布物の `dist` ディレクトリの中身を、次の場所に配置してください。

```text
docs/
├── index.html
├── style.css
├── app.js
└── vendor/
    └── mp-tikz-wasm/
        ├── index.js
        └── （配布物に含まれるその他のJS・WASM・データファイル）
```

配布物は [mp-tikz-wasm GitHub Releases](https://github.com/jmckalex/mp-tikz-wasm/releases) から取得してください。`app.js` は `./vendor/mp-tikz-wasm/index.js` を読み込みます。配布物のディレクトリ構造を保ったまま配置してください。

**重要：** エンジンの配布ファイルはサイズが大きいため、このZIPには含めていません。配置前はコンパイル機能は動作しません。エンジンファイルもGitHubリポジトリにコミットすれば、Deploy from a branchで配信できます。

## 操作

- 左側に `\documentclass` から `\end{document}` までの完全なLaTeX文書を入力
- **コンパイル** または `Ctrl/Cmd + Enter`
- 右側にPDFを表示
- PDF・`.tex` を保存

コンパイルはブラウザ内で実行され、ソースコードをコンパイルサーバーへ送信しません。

## 注意

- 初回はWebAssemblyエンジン・パッケージの読み込みに時間がかかります。
- エンジン配布物に含まれるパッケージが利用対象です。全TeX Liveパッケージを保証するものではありません。
- 日本語組版にはエンジンや日本語パッケージ・フォントの追加設定が必要な場合があります。
- `Deploy from a branch` はGitHub Actionsによるビルド工程を実行しません。エンジン配布ファイルは自分で `docs/vendor/` に追加してください。
