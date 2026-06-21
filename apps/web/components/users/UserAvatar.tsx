type UserAvatarProps = {
  username: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-8 w-8 text-xs",
  md: "h-14 w-14 text-lg",
  lg: "h-24 w-24 text-3xl",
};

const palette = [
  "bg-moss text-white",
  "bg-brass text-white",
  "bg-stone-700 text-white",
  "bg-emerald-700 text-white",
  "bg-sky-700 text-white",
  "bg-rose-700 text-white",
];

export function UserAvatar({ username, avatarUrl = "", size = "md" }: UserAvatarProps) {
  const label = username.trim().slice(0, 1).toUpperCase() || "?";
  const color = palette[hashUsername(username) % palette.length];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${username} 的头像`}
        className={`${sizeClass[size]} rounded-full border border-stone-200 object-cover`}
      />
    );
  }

  return (
    <div
      aria-label={`${username} 的默认头像`}
      className={`${sizeClass[size]} grid place-items-center rounded-full ${color} font-semibold`}
    >
      {label}
    </div>
  );
}

function hashUsername(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
