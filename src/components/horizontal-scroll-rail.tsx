"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type HorizontalScrollRailProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  railClassName?: string;
};

export function HorizontalScrollRail({
  children,
  className = "",
  contentClassName = "flex w-max gap-3",
  railClassName = "-mx-4 -mt-2 cursor-grab select-none overflow-x-auto overscroll-x-contain px-4 pb-2 pt-2 active:cursor-grabbing [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&_*]:select-none [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none] [&::-webkit-scrollbar]:hidden",
}: HorizontalScrollRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);
  const pointerDownRef = useRef(false);
  const capturedPointerIdRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;

    if (!rail) return;

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;

    setCanScrollLeft(rail.scrollLeft > 2);
    setCanScrollRight(rail.scrollLeft < maxScrollLeft - 2);
  }, []);

  useEffect(() => {
    const rail = railRef.current;

    if (!rail) return;

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  function scrollByPage(direction: -1 | 1) {
    const rail = railRef.current;

    if (!rail) return;

    rail.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(rail.clientWidth * 0.72, 280),
    });
  }

  function releasePointerCapture(pointerId: number) {
    const rail = railRef.current;

    if (!rail || capturedPointerIdRef.current !== pointerId) return;

    if (rail.hasPointerCapture(pointerId)) {
      rail.releasePointerCapture(pointerId);
    }

    capturedPointerIdRef.current = null;
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={railRef}
        className={railClassName}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!draggedRef.current) return;

          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }}
        onPointerDown={(event) => {
          const rail = railRef.current;

          if (!rail || event.button !== 0) return;

          pointerDownRef.current = true;
          draggedRef.current = false;
          dragStartXRef.current = event.clientX;
          dragStartYRef.current = event.clientY;
          dragStartScrollLeftRef.current = rail.scrollLeft;
        }}
        onPointerMove={(event) => {
          const rail = railRef.current;

          if (!rail || !pointerDownRef.current) return;

          const deltaX = event.clientX - dragStartXRef.current;
          const deltaY = event.clientY - dragStartYRef.current;
          const isHorizontalDrag = Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY);

          if (isHorizontalDrag) {
            draggedRef.current = true;

            if (capturedPointerIdRef.current === null) {
              rail.setPointerCapture(event.pointerId);
              capturedPointerIdRef.current = event.pointerId;
            }
          }

          if (!draggedRef.current) return;

          event.preventDefault();
          rail.scrollLeft = dragStartScrollLeftRef.current - deltaX;
        }}
        onPointerUp={(event) => {
          pointerDownRef.current = false;
          releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          pointerDownRef.current = false;
          draggedRef.current = false;
          releasePointerCapture(event.pointerId);
        }}
      >
        <div className={contentClassName}>{children}</div>
      </div>

      {canScrollLeft ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 z-10 hidden size-10 -translate-y-1/2 rounded-full bg-background/95 shadow-md backdrop-blur md:inline-flex"
          onClick={() => scrollByPage(-1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
      ) : null}

      {canScrollRight ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 z-10 hidden size-10 -translate-y-1/2 rounded-full bg-background/95 shadow-md backdrop-blur md:inline-flex"
          onClick={() => scrollByPage(1)}
        >
          <ChevronRight className="size-5" />
        </Button>
      ) : null}
    </div>
  );
}
