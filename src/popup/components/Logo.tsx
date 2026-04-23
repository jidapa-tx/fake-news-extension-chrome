type LogoSize = 16 | 36 | 48 | 128;

const sizeMap: Record<LogoSize, { container: string; text: string }> = {
  16:  { container: "w-4 h-4 rounded",        text: "text-[8px]"  },
  36:  { container: "w-9 h-9 rounded-lg",      text: "text-lg"     },
  48:  { container: "w-12 h-12 rounded-xl",    text: "text-2xl"    },
  128: { container: "w-32 h-32 rounded-3xl",   text: "text-6xl"    },
};

interface Props {
  size: LogoSize;
}

export function Logo({ size }: Props) {
  const { container, text } = sizeMap[size];
  return (
    <div className={`${container} bg-white flex items-center justify-center`}>
      <span className={`text-blue-800 font-bold leading-none ${text}`}>✓</span>
    </div>
  );
}
