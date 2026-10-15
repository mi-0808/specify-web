import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-16 px-5 py-8">
        <header className="flex items-center justify-between">
          <p className="text-lg font-bold tracking-tight">Specify</p>
          <Link
            href="/login"
            className="rounded-full border border-outline px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-container-lowest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ログイン
          </Link>
        </header>

        <section className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            理想の部屋を、
            <br />
            今買える家具の
            <br />
            レシピに。
          </h1>
          <p className="text-base leading-7 text-on-surface-variant">
            SNSで見たあの雰囲気を、ニトリ・IKEA・無印などで実際に買える家具の組み合わせにします。どこで、いくらで買えるかまで分かります。
          </p>
        </section>
      </div>
    </main>
  );
}
