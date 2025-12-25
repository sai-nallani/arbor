import React, { useEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';

export default function OrbitEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const orbRef = useRef<SVGCircleElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check timestamp to trigger new animation
    if (data?.isAnimating && !isAnimating) {
      setIsAnimating(true);
      startTimeRef.current = undefined;
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [data?.isAnimating]);

  const animate = (time: number) => {
    if (startTimeRef.current === undefined) {
      startTimeRef.current = time;
    }

    // Duration 1000ms
    const duration = 1000;
    const elapsed = time - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);

    if (orbRef.current) {
      // offsetDistance Support might vary, using style
      // @ts-ignore
      orbRef.current.style.offsetDistance = `${ease * 100}%`;
      orbRef.current.style.opacity = '1';
    }

    if (progress < 1) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      // Finished
      setIsAnimating(false);
      if (orbRef.current) {
        orbRef.current.style.opacity = '0';
      }
    }
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <circle
        ref={orbRef}
        r="8"
        fill="var(--accent)"
        className="orbit-orb"
        style={{
          opacity: 0,
          offsetPath: `path('${edgePath}')`,
          offsetRotate: '0deg',
          transition: 'opacity 0.2s',
          pointerEvents: 'none'
        }}
      />
    </>
  );
}
