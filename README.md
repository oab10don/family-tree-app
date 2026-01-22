# 家系図作成ツール (Family Tree Creator)

オンラインで家系図を作成できるWebアプリケーションです。

## 主な機能

- ✅ ドラッグ&ドロップで自由に配置
- ✅ 人物情報の詳細編集（名前、性別、生没年、写真など）
- ✅ テーマ切り替え（和風/モダン）
- ✅ 表示項目のカスタマイズ
- ✅ JSON形式でのエクスポート/インポート
- ✅ 画像としてのダウンロード
- ✅ ズーム・パン操作

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **UIライブラリ**: React Flow (家系図描画)
- **スタイリング**: Tailwind CSS
- **画像生成**: html-to-image

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

### 3. ビルド

```bash
npm run build
npm start
```

## 使い方

### 基本操作

1. **人物の編集**: ノードをダブルクリックして情報を編集
2. **移動**: ノードをドラッグして配置を調整
3. **ズーム**: マウスホイールまたは右下のコントロール
4. **パン**: キャンバスをドラッグ

### 保存・読み込み

- **JSON保存**: サイドバーの「JSON形式でエクスポート」をクリック
- **JSON読み込み**: サイドバーの「JSON形式でインポート」をクリックしてファイルを選択
- **画像保存**: サイドバーの「画像としてダウンロード」をクリック

### 表示設定

サイドバーから以下の項目をカスタマイズできます：

- テーマ（和風/モダン）
- 性別による色分け
- ノードの影
- 枠線の表示
- 写真、名前、生没年などの表示/非表示

## プロジェクト構成

```
family-tree-app/
├── app/
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # メインページ
├── components/
│   ├── ui/                # 再利用可能なUIコンポーネント
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── switch.tsx
│   │   └── checkbox.tsx
│   ├── FamilyTreeApp.tsx  # メインコンポーネント
│   ├── PersonNode.tsx     # 人物ノード
│   ├── PersonEditDialog.tsx # 編集ダイアログ
│   └── Sidebar.tsx        # サイドバー
├── types/
│   └── familyTree.ts      # 型定義
├── lib/
│   └── utils.ts           # ユーティリティ関数
└── package.json
```

## カスタマイズ

### 新しい人物の追加

現在はノードをダブルクリックして既存の人物を編集できます。
新しい人物を追加する機能は、以下のように実装できます：

1. サイドバーに「人物を追加」ボタンを追加
2. クリック時に新しいノードを生成
3. 自動でIDを採番

### 関係線のカスタマイズ

`FamilyTreeApp.tsx`の`onConnect`関数で、
エッジのスタイルをカスタマイズできます：

```typescript
const onConnect = useCallback(
  (params: Connection) => {
    const newEdge: Edge = {
      ...params,
      id: `e${params.source}-${params.target}`,
      type: 'smoothstep',
      style: {
        stroke: '#ef4444',  // 色
        strokeWidth: 2,      // 太さ
      },
    };
    setEdges((eds) => addEdge(newEdge, eds));
  },
  [setEdges]
);
```

## トラブルシューティング

### 画像が保存できない

- ブラウザのポップアップブロックを確認してください
- 開発者ツールのコンソールでエラーを確認してください

### JSONファイルが読み込めない

- ファイル形式が正しいJSON形式か確認してください
- バージョンの互換性を確認してください

## ライセンス

MIT License

## 今後の拡張案

- [ ] 人物の追加・削除ボタン
- [ ] 親子関係の自動レイアウト
- [ ] 複数の配偶者への対応
- [ ] PDF出力機能
- [ ] 印刷用レイアウト
- [ ] モバイル対応の強化
- [ ] Undo/Redo機能
- [ ] 検索機能
