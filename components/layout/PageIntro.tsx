export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="bg-forest-950 px-5 pb-16 pt-32 text-ivory-50 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.28em] text-gold-400">{eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-ivory-200/80">{lede}</p>
      </div>
    </header>
  );
}
