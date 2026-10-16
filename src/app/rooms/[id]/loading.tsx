// 部屋のカードを押したらすぐ画面を切り替え、データが届くまで枠だけ出す
export default function Loading() {
  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 pb-8 pt-8">
        <div className="size-11" />
        <div className="space-y-3" aria-busy="true" aria-label="読み込み中">
          <div className="aspect-video w-full rounded-2xl bg-surface-container" />
          <div className="h-7 w-3/4 rounded bg-surface-container" />
        </div>
      </div>
    </main>
  )
}
