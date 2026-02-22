'use client';

import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';

type Props = {
  folder?: string; // URL path under /public
  displayMs?: number; // visible time (ms)
  transitionMs?: number; // cross-fade duration (ms)
  className?: string;
};

export default function PhotoSlideshow({
  folder = '/photos',
  displayMs = 5000,
  transitionMs = 5000,
  className = '',
}: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const mounted = useRef(true);

  const cycleMs = displayMs + transitionMs;

  useEffect(() => {
    mounted.current = true;

    // load index.txt which should list filenames (one per line)
    fetch(`${folder}/index.txt`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('index.txt not found');
        return res.text();
      })
      .then(text => {
        if (!mounted.current) return;
        const list = text
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
          .filter(l => /\.webp$/i.test(l));
        if (list.length > 0) {
          // convert to full urls
          const urls = list.map(name => `${folder}/${name}`);
          setImages(urls);
        }
      })
      .catch(() => {
        // fallback: try a single file named photo.jpg
        setImages([`${folder}/photo.webp`]);
      });

    return () => {
      mounted.current = false;
    };
  }, [folder]);

  // cycle timer
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => {
      setIdx(i => (i + 1) % images.length);
    }, cycleMs);
    return () => clearInterval(t);
  }, [images, cycleMs]);

  // preload next image when index changes
  useEffect(() => {
    if (images.length <= 1) return;
    const next = images[(idx + 1) % images.length];
    // use the global Image constructor (avoid conflict with imported `Image` component)
    const pre = new window.Image();
    pre.src = next;
  }, [idx, images]);

  if (images.length === 0) {
    // still loading — keep placeholder area
    return (
      <div
        className={`photo-slideshow ${className} bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center rounded-[5px] overflow-hidden h-[300px]`}
      />
    );
  }

  const cssVar: React.CSSProperties & Record<string, string> = {
    ['--slideshow-transition-ms']: `${transitionMs}ms`,
  };

  return (
    <div
      className={`photo-slideshow relative ${className} rounded-[5px] overflow-hidden`}
      style={cssVar}
    >
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={`photo ${i + 1}`}
          fill
          className={`slide-img absolute inset-0 w-full h-full object-cover transition-opacity ${i === idx ? 'active' : ''}`}
          priority={i === idx}
          sizes="(max-width: 640px) 100vw, 420px"
          style={{ objectFit: 'cover', borderRadius: 5 }}
        />
      ))}
    </div>
  );
}
