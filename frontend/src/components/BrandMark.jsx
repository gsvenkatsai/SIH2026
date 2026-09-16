/**
 * MediKiosk brand mark — a single organic form combining leaf + care:
 * a leaf whose midrib is a quiet heartbeat line. Works in monochrome
 * (currentColor inherits surrounding text color).
 */
export default function BrandMark({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Leaf body */}
      <path
        d="M16 3C9 7.5 5.5 13 5.5 19.2 5.5 24.5 9.4 28.5 16 28.5s10.5-4 10.5-9.3C26.5 13 23 7.5 16 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Heartbeat midrib */}
      <path
        d="M16 8v5.2h-3.4l2.2 4.4 2.4-6 1.8 3.6h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
