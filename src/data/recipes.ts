// レシピは人が選んで公式サイトで確認したものだけを載せる（docs/specify-recipe-mvp.md 4章）
// 価格・在庫を確認し直したら checkedAt を更新する

export type StyleId = "korean" | "nordic" | "cafe"

export type Style = {
  id: StyleId
  name: string
  description: string
}

export type Shop = "nitori" | "ikea" | "muji" | "3coins"

export type RecipeItem = {
  id: string // 記録のキー。一度決めたら変えない
  role: string
  name: string
  shop: Shop
  price: number // 税込・円
  url: string
  reason: string
  checkedAt: string // YYYY-MM-DD
}

export const BUDGETS = [30000, 50000, 100000] as const
export type Budget = (typeof BUDGETS)[number]

export type Recipe = {
  id: string // `${style}-${budget}`
  style: StyleId
  budget: Budget
  items: RecipeItem[] // 買う順
}

export const SHOPS: Record<Shop, { name: string; host: string }> = {
  nitori: { name: "ニトリ", host: "www.nitori-net.jp" },
  ikea: { name: "IKEA", host: "www.ikea.com" },
  muji: { name: "無印良品", host: "www.muji.com" },
  "3coins": { name: "3COINS", host: "www.palcloset.jp" },
}

export const STYLES: Style[] = [
  { id: "korean", name: "韓国風", description: "白とベージュに、ポコポコした質感と曲線を足した、やわらかい部屋" },
  { id: "nordic", name: "北欧ナチュラル", description: "明るい木の色と白に、くすんだ色をひとつ差した、落ち着く部屋" },
  { id: "cafe", name: "カフェ風", description: "濃い木の色とアイアンに、あたたかい光を合わせた、こもれる部屋" },
]

export const RECIPES: Recipe[] = [
  {
    id: "korean-50000",
    style: "korean",
    budget: 50000,
    items: [
      {
        id: "rug",
        role: "ラグ",
        name: "きらめくポコポコシャギーラグ メルア ベージュ 120×180cm",
        shop: "nitori",
        price: 9990,
        url: "https://www.nitori-net.jp/ec/product/4524370480379/",
        reason: "床の面積が一番広いので、1点で雰囲気が変わる。ポコポコした質感が韓国風の定番",
        checkedAt: "2026-10-15",
      },
      {
        id: "bed-cover",
        role: "ベッドカバー",
        name: "洗えるコットンキルトラグ マルチカバー アイボリー 130×190cm",
        shop: "nitori",
        price: 5990,
        url: "https://www.nitori-net.jp/ec/product/5657405/",
        reason: "ベッドに掛けるだけで、イブル風のキルト素材になる",
        checkedAt: "2026-10-15",
      },
      {
        id: "curtain",
        role: "カーテン",
        name: "レースカーテン ドイリー アイボリー 100×198cm 2枚",
        shop: "nitori",
        price: 4990,
        url: "https://www.nitori-net.jp/ec/product/7316314/",
        reason: "白い光が入る窓辺は、韓国風の写真で必ず映る場所",
        checkedAt: "2026-10-15",
      },
      {
        id: "mirror",
        role: "ミラー",
        name: "【アーチ型】スタンドミラー 002IT ゴールド 幅40×高さ150cm",
        shop: "nitori",
        price: 4990,
        url: "https://www.nitori-net.jp/ec/product/8100739s/",
        reason: "アーチ型は韓国風の象徴。立てかけ式なので壁に穴を開けない",
        checkedAt: "2026-10-15",
      },
      {
        id: "lamp",
        role: "照明",
        name: "TÄRNABY テールナビー テーブルランプ 調光可能 ベージュ",
        shop: "ikea",
        price: 3999,
        url: "https://www.ikea.com/jp/ja/p/taernaby-table-lamp-dimmable-beige-50508077/",
        reason: "きのこ型のランプ。夜の暖かい光で写真映えする",
        checkedAt: "2026-10-15",
      },
      {
        id: "side-table",
        role: "サイドテーブル",
        name: "GLADOM グラドム トレイテーブル ホワイト 45×53cm",
        shop: "ikea",
        price: 1999,
        url: "https://www.ikea.com/jp/ja/p/gladom-tray-table-white-50337820/",
        reason: "ランプや花瓶の置き場になる。狭い部屋でも邪魔にならない",
        checkedAt: "2026-10-15",
      },
      {
        id: "cushion",
        role: "クッション",
        name: "円形クッション ダリア2 アイボリー 直径40cm",
        shop: "nitori",
        price: 1990,
        url: "https://www.nitori-net.jp/ec/product/5780958/",
        reason: "花の形のクッションは、韓国風でよく見る小物",
        checkedAt: "2026-10-15",
      },
      {
        id: "art",
        role: "アート",
        name: "タフティングアートパネル M ベージュ 約39.5×31cm",
        shop: "3coins",
        price: 1650,
        url: "https://www.palcloset.jp/display/item/2622-TUFTA3-000/?b=3coins",
        reason: "立てかけて飾れる。ポコポコした質感がラグとそろう",
        checkedAt: "2026-10-15",
      },
      {
        id: "vase",
        role: "花瓶",
        name: "BERÄKNA ベレークナ 花瓶 クリアガラス 15cm",
        shop: "ikea",
        price: 399,
        url: "https://www.ikea.com/jp/ja/p/beraekna-vase-clear-glass-50457775/",
        reason: "透明ガラスに白い花の組み合わせが定番",
        checkedAt: "2026-10-15",
      },
      {
        id: "flowers",
        role: "造花",
        name: "SMYCKA スミッカ 造花 スイートピー ホワイト 60cm 3本",
        shop: "ikea",
        price: 1497,
        url: "https://www.ikea.com/jp/ja/p/smycka-artificial-flower-sweet-pea-white-50409770/",
        reason: "枯れないので手間がかからない",
        checkedAt: "2026-10-15",
      },
    ],
  },
]

export const findStyle = (id: string) => STYLES.find((s) => s.id === id)
export const findRecipe = (id: string) => RECIPES.find((r) => r.id === id)
export const findRecipeFor = (style: StyleId, budget: Budget) =>
  RECIPES.find((r) => r.style === style && r.budget === budget)
export const totalOf = (recipe: Recipe) => recipe.items.reduce((sum, i) => sum + i.price, 0)
export const latestCheckedAt = (recipe: Recipe) =>
  recipe.items.map((i) => i.checkedAt).sort().at(-1)!

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`
export const budgetLabel = (b: Budget) => `${b / 10000}万円`
