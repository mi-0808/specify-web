import type { RecipeItem } from "@/data/recipes"

// 店の画像をそのまま表示する。next/image を使うとこちらのサーバーに複製されるため、あえて <img> にしている
export function ProductPhoto({ item, className = "" }: { item: RecipeItem; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        className="aspect-square w-full object-contain"
      />
    </div>
  )
}
