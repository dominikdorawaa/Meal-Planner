interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span className={`font-headline font-extrabold tracking-tight ${className}`.trim()}>
      <span aria-hidden="true">Cal<span className="font-normal">end</span>ories</span>
      <span className="sr-only">Calendories</span>
    </span>
  );
}
