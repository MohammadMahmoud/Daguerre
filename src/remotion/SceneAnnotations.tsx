import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { THEME } from './Theme';
import { GlassWindow } from './Components';
import editorImage from './Assets/EditorView.png';

/**
 * Scene 3: Creative Annotation & Redaction Suite (Frames 1080–1680 | 18.0s – 28.0s)
 * Shows the full annotation toolbar with drawing tools, step counters, and privacy redaction.
 */
export function SceneAnnotations(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const enterSpring = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });

  const scale = interpolate(enterSpring, [0, 1], [0.93, 1.03]);
  const opacity = interpolate(enterSpring, [0, 0.3], [0, 1]);

  // Section headline spring
  const headlineSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [24, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 0.4], [0, 1]);

  // Redaction box expansion (frames 140 to 280)
  const redactSpring = spring({
    frame: frame - 140,
    fps,
    config: THEME.springs.snappy,
  });
  const redactWidth = interpolate(redactSpring, [0, 1], [0, 260]);
  const redactOpacity = interpolate(redactSpring, [0, 0.3], [0, 1]);

  // Step badges drop-in (frames 260 and 340)
  const step1Spring = spring({
    frame: frame - 260,
    fps,
    config: THEME.springs.tactile,
  });
  const step2Spring = spring({
    frame: frame - 320,
    fps,
    config: THEME.springs.tactile,
  });

  const step1Scale = interpolate(step1Spring, [0, 1], [0, 1]);
  const step2Scale = interpolate(step2Spring, [0, 1], [0, 1]);

  // Arrow drawing animation (frames 360 to 480)
  const arrowSpring = spring({
    frame: frame - 360,
    fps,
    config: THEME.springs.snappy,
  });
  const arrowProgress = interpolate(arrowSpring, [0, 1], [0, 1]);

  // Exit transition (frames 560 to 600)
  const exitProgress = interpolate(frame, [560, 600], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneExitScale = 1 + exitProgress * 0.12;
  const sceneExitOpacity = 1 - exitProgress * 0.9;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale * sceneExitScale})`,
        opacity: opacity * sceneExitOpacity,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 32,
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
        }}
      >
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: THEME.colors.accentCyan,
            marginBottom: 8,
            display: 'block',
          }}
        >
          Precision Editor
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: THEME.colors.textPrimary,
          }}
        >
          Annotation & Privacy Redaction Suite
        </h1>
      </div>

      {/* Editor Canvas Window */}
      <div style={{ position: 'relative' }}>
        <GlassWindow width={1380} height={760} scale={1.0}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img
              src={editorImage}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
            />

            {/* Interactive Privacy Redaction Blur Box */}
            {redactWidth > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 360,
                  left: 360,
                  width: redactWidth,
                  height: 48,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1.5px dashed rgba(255, 69, 58, 0.75)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(255, 69, 58, 0.35)',
                  opacity: redactOpacity,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FF453A',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                [Redacted Contact Details]
              </div>
            )}

            {/* Step Counter 1 */}
            {step1Scale > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 240,
                  left: 480,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#0A84FF',
                  boxShadow: '0 8px 20px rgba(10, 132, 255, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 18,
                  transform: `scale(${step1Scale})`,
                }}
              >
                1
              </div>
            )}

            {/* Step Counter 2 */}
            {step2Scale > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 480,
                  left: 740,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#30D158',
                  boxShadow: '0 8px 20px rgba(48, 209, 88, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 18,
                  transform: `scale(${step2Scale})`,
                }}
              >
                2
              </div>
            )}

            {/* Dynamic Arrow Annotation Path */}
            {arrowProgress > 0 && (
              <svg
                style={{
                  position: 'absolute',
                  top: 280,
                  left: 520,
                  width: 240,
                  height: 180,
                  pointerEvents: 'none',
                }}
              >
                <defs>
                  <marker
                    id='arrowhead-remotion'
                    markerWidth='8'
                    markerHeight='8'
                    refX='6'
                    refY='4'
                    orient='auto'
                  >
                    <polygon points='0 0, 8 4, 0 8' fill='#0A84FF' />
                  </marker>
                </defs>
                <path
                  d='M 10 10 Q 120 60 210 140'
                  stroke='#0A84FF'
                  strokeWidth='4'
                  fill='none'
                  strokeDasharray='300'
                  strokeDashoffset={300 * (1 - arrowProgress)}
                  markerEnd='url(#arrowhead-remotion)'
                />
              </svg>
            )}
          </div>
        </GlassWindow>
      </div>
    </div>
  );
}
