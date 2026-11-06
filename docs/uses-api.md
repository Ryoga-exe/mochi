# uses API

物品詳細の「uses の公開設定」で公開内容を入力し、「公開内容を保存して公開」で反映します。管理用の品名・メモ・タグ・収納先・管理番号は API に含まれません。公開用の入力欄は空欄から始まります。

## 説明と画像

- 公開用の説明は Markdown、最大2万文字。見出し・リスト・表・コード・リンクに対応します。HTML・MDX・外部画像の埋め込みは受け付けません。
- 画像は1物品20枚まで。ファイル選択または対応端末のカメラから追加できます。元画像は20MBまでで、ブラウザーで長辺2000px以下の JPEG / PNG に変換します。保存時に EXIF・位置情報・テキストなどのメタデータを除去します。保存画像は5MB・縦横2400px以下です。
- アップロードした画像は非公開です。uses の公開対象に選んだ画像だけが公開されます。
- 「本文に挿入」は、入力位置に `![画像の説明](mochi-asset:画像ID)` を追加し、その画像を公開対象に選びます。代替テキストは本文の `画像の説明` を編集します。段落の間に何枚でも挿入できます（物品の20枚の範囲内）。
- 「ギャラリーにも表示する」で本文とは別の画像一覧にも載せられます。代替テキスト・説明・順序を指定できます。API の `images` は公開対象すべての配列で、`inGallery` がギャラリーへの表示指定です。
- プレビューは保存前の内容を確認するためのものです。保存すると入力した公開内容に置き換わります。公開中の版と編集中の下書きを別々には保持しません。「下書きを保存」は非公開への切り替えも行います。

公開設定で参照中の画像は削除できません。本文の画像記法と公開対象の選択を外して保存した後、画像を削除してください。物品のアーカイブ時は自動で非公開になり、管理中に戻しても自動公開されません。

## エンドポイント

すべて認証不要の読み取り専用で、別のサイトから利用できるよう `Access-Control-Allow-Origin: *` を返します。未公開・存在しない詳細や画像は `404`、不正なページ指定は `400` です。

| GET                                | レスポンス                                       |
| ---------------------------------- | ------------------------------------------------ |
| `/api/v1/uses?limit=20&offset=0`   | `{ apiVersion: 1, items, total, limit, offset }` |
| `/api/v1/uses/:id`                 | 公開物品1件                                      |
| `/api/v1/uses/:id/images/:assetId` | 選択された画像                                   |

`limit` は1〜50、`offset` は0以上の整数です。一覧は表示順、同順なら公開 ID 順に並びます。`id` は管理用の物品 ID とは別の公開 ID です。

```json
{
  "id": "公開ID",
  "title": "Camera",
  "descriptionMarkdown": "前の段落。\n\n![使用例](https://mochi.example/api/v1/uses/公開ID/images/画像ID)\n\n後の段落。\n",
  "descriptionHtml": "<p>前の段落。</p>\n<p><img src=\"https://mochi.example/api/v1/uses/公開ID/images/画像ID\" alt=\"使用例\" loading=\"lazy\"/></p>\n<p>後の段落。</p>",
  "externalUrl": "https://example.com/camera",
  "section": "Cameras",
  "tags": ["camera"],
  "images": [
    {
      "assetId": "画像ID",
      "url": "https://mochi.example/api/v1/uses/公開ID/images/画像ID",
      "alt": "使用例",
      "caption": "撮影時の構成",
      "inGallery": false,
      "width": 1600,
      "height": 1200
    }
  ],
  "updatedAt": "2026-11-07T00:00:00.000Z"
}
```

`descriptionMarkdown` は画像記法を絶対 URL に置換した Markdown、`descriptionHtml` は同じ本文を安全な HTML に変換したものです。用途に応じて片方を使います。画像 URL のオリジンは公開設定を保存したアプリのオリジンです。ドメイン変更後は再保存してください。

公開 API と画像は `Cache-Control: no-store` を返します。非公開に戻すと次のリクエストから詳細と画像は `404` になります。利用側で静的サイトに取り込んだデータや独自にキャッシュした画像の更新は、利用側で行ってください。

```js
const response = await fetch("https://mochi.example/api/v1/uses?limit=50");
if (!response.ok) throw new Error("uses API failed");
const { items, total } = await response.json();
// total が50より大きい場合は offset=50, 100, ... で続きを取得する。
```
