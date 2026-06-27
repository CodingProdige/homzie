import Link from "next/link";

import { cn } from "@/lib/utils";

const captionTokenPattern =
  /(#[a-z0-9_]{2,40}|@[a-z0-9][a-z0-9._]{1,28}[a-z0-9])/gi;

export function RichCaption({
  className,
  text,
}: {
  className?: string;
  text: string;
}) {
  const parts = text.split(captionTokenPattern).filter(Boolean);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) => {
        if (part.startsWith("#")) {
          return (
            <strong className="font-semibold" key={`${part}-${index}`}>
              {part}
            </strong>
          );
        }

        if (part.startsWith("@")) {
          const username = part.slice(1);

          return (
            <Link
              className="font-semibold text-sky-500 hover:underline"
              href={`/users/${username}`}
              key={`${part}-${index}`}
            >
              {part}
            </Link>
          );
        }

        return part;
      })}
    </span>
  );
}
