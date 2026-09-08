type Props = {
  className?: string;
  title?: string;
  subtitle?: string;
};

/** Overlay CTA virtual tour — selaras Figma node 188:3360 */
export default function VirtualTourStartOverlay({
  className = "",
  title = "Station Virtual Tour",
  subtitle = "Klik Untuk Memulai Virtual Tour 360°",
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center text-white ${className}`}
    >
      <div className="relative flex size-[104px] items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/landing/icons/tour-start-glow.svg"
          alt=""
          width={262}
          height={269}
          className="pointer-events-none absolute top-1/2 left-1/2 size-[262px] max-w-none -translate-x-1/2 -translate-y-1/2"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/landing/icons/tour-start-360.svg"
          alt=""
          width={104}
          height={100}
          className="relative size-[104px]"
        />
      </div>

      <div className="mt-3 flex w-[220px] flex-col items-center tracking-[0.56px]">
        <p className="w-full text-sm leading-5 font-bold">{title}</p>
        <p className="mt-0.5 w-full text-[9px] leading-5 underline underline-offset-2">{subtitle}</p>
      </div>
    </div>
  );
}
