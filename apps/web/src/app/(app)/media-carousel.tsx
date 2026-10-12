'use client';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import IconButton from '@mui/material/IconButton';
import { useRef, useState } from 'react';

import { frameAspect } from '@instagram-clone/design-tokens';
import type { PostResponse } from '@instagram-clone/validation';

/**
 * A post's photos: a horizontally scroll-snapping strip (swipe on touch,
 * arrows on wider screens) with page dots, framed at the first photo's aspect
 * ratio like Instagram. Plain CSS scroll-snap — no carousel dependency.
 * Every photo is a real `<img>` in the DOM, not lazily mounted.
 */
export function MediaCarousel({ media }: { media: PostResponse['media'] }) {
  const stripRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const multiple = media.length > 1;

  function handleScroll() {
    const strip = stripRef.current;
    if (!strip || strip.clientWidth === 0) return;
    setIndex(Math.round(strip.scrollLeft / strip.clientWidth));
  }

  function goTo(target: number) {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollTo({ left: target * strip.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative bg-surface-variant">
      <ul
        ref={stripRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ aspectRatio: frameAspect(media[0]?.width, media[0]?.height) }}
      >
        {media.map((item, position) => (
          <li key={item.id} className="w-full shrink-0 snap-center">
            <img
              src={item.url}
              alt={item.altText ?? ''}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              loading={position === 0 ? 'eager' : 'lazy'}
              className="h-full w-full object-cover"
            />
          </li>
        ))}
      </ul>
      {multiple && (
        <>
          {index > 0 && (
            <IconButton
              aria-label="Previous photo"
              onClick={() => goTo(index - 1)}
              size="small"
              className="absolute top-1/2 left-2 hidden -translate-y-1/2 bg-background/80 hover:bg-background md:inline-flex"
            >
              <ChevronLeftIcon />
            </IconButton>
          )}
          {index < media.length - 1 && (
            <IconButton
              aria-label="Next photo"
              onClick={() => goTo(index + 1)}
              size="small"
              className="absolute top-1/2 right-2 hidden -translate-y-1/2 bg-background/80 hover:bg-background md:inline-flex"
            >
              <ChevronRightIcon />
            </IconButton>
          )}
          <p className="sr-only" aria-live="polite">
            Photo {index + 1} of {media.length}
          </p>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-2 flex justify-center gap-1"
          >
            {media.map((item, position) => (
              <span
                key={item.id}
                className={`size-1.5 rounded-full ${position === index ? 'bg-primary' : 'bg-background/70'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
