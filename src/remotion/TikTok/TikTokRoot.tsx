import React from 'react';
import { Composition } from 'remotion';
import { TikTokSequence } from './TikTokSequence';

/**
 * Remotion Root configuration for TikTok / Reels vertical product video.
 * Registers the 15-second 60fps vertical composition (1080x1920).
 */
export function TikTokRoot(): React.JSX.Element {
  return (
    <Composition
      id='TikTokVertical'
      component={TikTokSequence}
      durationInFrames={900}
      fps={60}
      width={1080}
      height={1920}
    />
  );
}
