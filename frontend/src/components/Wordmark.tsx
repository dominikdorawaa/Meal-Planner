interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span className={`font-headline font-extrabold tracking-tight ${className}`.trim()}>
      Cal<span className="font-normal">end</span>ories
    </span>
  );
}
