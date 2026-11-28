export type IllustrationName =
  | "wallet"
  | "security"
  | "guardians"
  | "recovery"
  | "assistant"
  | "mcp"
  | "rewards"
  | "resilience"
  | "achievement"
  | "activity";

interface ReKeyIllustrationProps {
  name: IllustrationName;
  className?: string;
  label?: string;
}

export function ReKeyIllustration({ name, className, label }: ReKeyIllustrationProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 180"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`/assets/rekey-illustrations.svg#${name}`} />
    </svg>
  );
}