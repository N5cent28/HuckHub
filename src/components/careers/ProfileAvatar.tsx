/* eslint-disable @next/next/no-img-element */

/** Round LinkedIn photo for verified members; renders nothing without one. */
export function ProfileAvatar({ url, size = 40 }: { url: string | null | undefined; size?: number }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="rounded-full object-cover border border-slate-200 shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
