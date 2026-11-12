import React from 'react';
import { Composition } from 'remotion';
import { LaunchSequence } from './LaunchSequence';
import { TikTokSequence } from './TikTok/TikTokSequence';
import { DesktopPromo } from './DesktopPromo';

/**
 * Remotion Root configuration.
 * Registers the 60-second landscape launch sequence, 600-frame (10-second) desktop promo,
 * and 15-second vertical TikTok/Reels compositions.
 */
export function Root(): React.JSX.Element {
  return (
    <>
      {/* 1080p Desktop Promo (10 seconds / 600 frames at 60fps) */}
      <Composition
        id='DesktopPromo'
        component={DesktopPromo}
        durationInFrames={600}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* 1080p Full HD Launch Sequence (Default - 60 seconds at 60fps = 3600 frames) */}
      <Composition
        id='LaunchSequence'
        component={LaunchSequence}
        durationInFrames={3600}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* 4K UHD Ultra HD Launch Sequence (60 seconds at 60fps = 3600 frames) */}
      <Composition
        id='LaunchSequence4K'
        component={LaunchSequence}
        durationInFrames={3600}
        fps={60}
        width={3840}
        height={2160}
      />

      {/* 15-Second 60fps Vertical TikTok / Reels Composition (9:16) */}
      <Composition
        id='TikTokVertical'
        component={TikTokSequence}
        durationInFrames={900}
        fps={60}
        width={1080}
        height={1920}
      />
    </>
  );
}
