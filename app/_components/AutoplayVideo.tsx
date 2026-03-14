"use client";

import React, { useEffect, useRef } from "react";

type AutoplayVideoProps = React.VideoHTMLAttributes<HTMLVideoElement>;

export function AutoplayVideo(props: AutoplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const tryPlay = () => {
      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        // Keep the poster visible when autoplay is blocked by browser policy.
        playPromise.catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && video.paused) {
        tryPlay();
      }
    };

    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return <video ref={videoRef} {...props} />;
}
