import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-8">
        <header className="flex items-center justify-between">
          <p className="text-lg font-bold tracking-tight">Specify</p>
          <Link
            href="/login"
            className="rounded-full border border-[#E8D8C7] px-3 py-1.5 text-sm font-medium text-[#6E5A4B] transition-colors hover:bg-white"
          >
            ログイン
          </Link>
        </header>

        <section className="space-y-7">
          <div className="inline-flex rounded-full bg-[#F5C842]/25 px-3 py-1 text-xs font-semibold text-[#8A5A10]">
            片づけの前に、置き場所を見つける
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              写真から、
              <br />
              暮らしの余白を
              <br />
              見つける。
            </h1>
            <p className="text-base leading-7 text-[#6E5A4B]">
              部屋と収納を撮るだけで、季節物や床まわりのしまい先をやさしく提案します。
            </p>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#E8D8C7]">
            <div className="h-2 bg-[#D96B2D]" />
            <div className="h-2 bg-[#F5C842]" />
            <div className="h-2 bg-[#3DAF85]" />
          </div>

          <div className="space-y-3">
            <Link
              href="/demo"
              className="block w-full rounded-lg bg-[#D96B2D] px-4 py-4 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#C85A20]"
            >
              写真を撮って試してみる（登録不要）
            </Link>
            <p className="text-center text-xs leading-5 text-[#9B806C]">
              両方の写真があると、提案の精度が上がります。
            </p>
          </div>
        </section>

        <footer className="grid grid-cols-3 gap-2 text-center text-xs text-[#8B7360]">
          <div className="rounded-lg border border-[#E8D8C7] bg-white/45 px-2 py-3">
            撮る
          </div>
          <div className="rounded-lg border border-[#E8D8C7] bg-white/45 px-2 py-3">
            見つける
          </div>
          <div className="rounded-lg border border-[#E8D8C7] bg-white/45 px-2 py-3">
            しまう
          </div>
        </footer>
      </div>
    </main>
  );
}
