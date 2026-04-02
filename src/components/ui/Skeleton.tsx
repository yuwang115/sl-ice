/**
 * Shimmer loading placeholder.
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

/** Full-page skeleton for lazy-loaded views */
export function PageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <Skeleton width={200} height={40} borderRadius={12} />
      <Skeleton width={300} height={16} />
      <div className="flex gap-3 mt-4">
        <Skeleton width={120} height={80} borderRadius={16} />
        <Skeleton width={120} height={80} borderRadius={16} />
        <Skeleton width={120} height={80} borderRadius={16} />
      </div>
    </div>
  );
}
