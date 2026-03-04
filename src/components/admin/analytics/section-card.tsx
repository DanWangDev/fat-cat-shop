interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="border-b border-warm-brown/10 px-6 py-4">
        <h2 className="font-display text-lg font-bold text-warm-brown">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
