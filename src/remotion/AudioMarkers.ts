/**
 * Frame markers and audio stem triggers for the Daguerre 60-second product launch video.
 * Derives sound cues across the 3600 frames (60fps) timeline for sound design alignment.
 */

export interface AudioTrigger {
  /** Target frame on the 60fps timeline (0 - 3599) */
  frame: number;
  /** Exact timestamp in seconds */
  timestamp: string;
  /** Identifier of the sound effect stem */
  stemId: string;
  /** Human-readable description of the sonic cue */
  description: string;
  /** Relative volume gain from 0.0 to 1.0 */
  volume: number;
}

export const AUDIO_MARKERS: readonly AudioTrigger[] = [
  // Scene 1: The Liquid Glass Reveal & Identity (Frames 0–480 | 0.0s – 8.0s)
  {
    frame: 0,
    timestamp: '0.00s',
    stemId: 'sfx_ambient_dive_riser',
    description: 'Deep cinematic sub-bass rise and ambient atmospheric dive',
    volume: 0.8,
  },
  {
    frame: 30,
    timestamp: '0.50s',
    stemId: 'sfx_glass_float_whoosh',
    description:
      'Silky air sweep as the 3D liquid glass window tilts into perspective',
    volume: 0.65,
  },
  {
    frame: 80,
    timestamp: '1.33s',
    stemId: 'sfx_specular_glint_chime',
    description:
      'High-frequency crystalline sparkle as specular catch-light glides across squircle bevel',
    volume: 0.55,
  },
  {
    frame: 140,
    timestamp: '2.33s',
    stemId: 'sfx_headline_impact',
    description:
      'Crisp, velvety typographical arrival for "Daguerre v1.0.6" title',
    volume: 0.7,
  },

  // Scene 2: Precision Multi-Mode Capture Studio (Frames 480–1080 | 8.0s – 18.0s)
  {
    frame: 480,
    timestamp: '8.00s',
    stemId: 'sfx_mode_switch_glide',
    description: 'Smooth camera glide transitioning into Capture Mode studio',
    volume: 0.7,
  },
  {
    frame: 540,
    timestamp: '9.00s',
    stemId: 'sfx_card_focus_selection',
    description: 'Subtle acoustic snap highlighting Area Selection crosshairs',
    volume: 0.75,
  },
  {
    frame: 680,
    timestamp: '11.33s',
    stemId: 'sfx_mechanical_shutter',
    description:
      'Crisp mechanical camera shutter sound as selection snapshot captures',
    volume: 0.9,
  },
  {
    frame: 820,
    timestamp: '13.67s',
    stemId: 'sfx_timer_tick_countdown',
    description:
      'Tactile rhythmic timer tick for 3s / 5s delay capture selector',
    volume: 0.6,
  },
  {
    frame: 960,
    timestamp: '16.00s',
    stemId: 'sfx_shortcut_keyboard_click',
    description:
      'Clean mechanical keyboard latch for Alt+Shift+S shortcut indicator',
    volume: 0.65,
  },

  // Scene 3: Creative Annotation & Redaction Suite (Frames 1080–1680 | 18.0s – 28.0s)
  {
    frame: 1080,
    timestamp: '18.00s',
    stemId: 'sfx_camera_push_editor',
    description: 'Dynamic zoom push into the Editor canvas workstation',
    volume: 0.75,
  },
  {
    frame: 1160,
    timestamp: '19.33s',
    stemId: 'sfx_tool_select_click',
    description: 'Satisfying haptic click as arrow and pen tools activate',
    volume: 0.6,
  },
  {
    frame: 1280,
    timestamp: '21.33s',
    stemId: 'sfx_annotation_draw_whoosh',
    description: 'Smooth vector stroke swoosh as directional arrow illuminates',
    volume: 0.65,
  },
  {
    frame: 1400,
    timestamp: '23.33s',
    stemId: 'sfx_step_counter_drop',
    description:
      'Pop-bubble sound as numbered step callout 1 and 2 drop onto canvas',
    volume: 0.7,
  },
  {
    frame: 1520,
    timestamp: '25.33s',
    stemId: 'sfx_redaction_blur_glide',
    description:
      'Textured pixelate sweep as privacy blur obscures sensitive contact email',
    volume: 0.7,
  },

  // Scene 4: Offline Live Text OCR & Searchable PDFs (Frames 1680–2340 | 28.0s – 39.0s)
  {
    frame: 1680,
    timestamp: '28.00s',
    stemId: 'sfx_ocr_mode_arrival',
    description:
      'Deep resonant tone introducing the on-device Live Text OCR suite',
    volume: 0.8,
  },
  {
    frame: 1760,
    timestamp: '29.33s',
    stemId: 'sfx_ocr_cursor_glide',
    description: 'Magnetic haptic buzz as pointer glides across text rows',
    volume: 0.55,
  },
  {
    frame: 1880,
    timestamp: '31.33s',
    stemId: 'sfx_ocr_bounding_lock',
    description:
      'Apple Live Text selection pop as bounding boxes illuminate translucent blue',
    volume: 0.75,
  },
  {
    frame: 2000,
    timestamp: '33.33s',
    stemId: 'sfx_ocr_copy_chime',
    description: 'Pure bell chime denoting instant offline clipboard copy',
    volume: 0.85,
  },
  {
    frame: 2160,
    timestamp: '36.00s',
    stemId: 'sfx_pdf_export_stamp',
    description:
      'Crisp tactile page-turn snap as Searchable PDF text layer compiles',
    volume: 0.75,
  },

  // Scene 5: Local History & Instant Search (Frames 2340–2880 | 39.0s – 48.0s)
  {
    frame: 2340,
    timestamp: '39.00s',
    stemId: 'sfx_history_grid_slide',
    description: 'Silky fluid whoosh transitioning to the History gallery grid',
    volume: 0.7,
  },
  {
    frame: 2460,
    timestamp: '41.00s',
    stemId: 'sfx_search_typing_burst',
    description:
      'Rapid keyboard keypresses demonstrating instant client-side search',
    volume: 0.6,
  },
  {
    frame: 2600,
    timestamp: '43.33s',
    stemId: 'sfx_thumbnail_hover_pop',
    description: 'Micro-elevation spring pop on capture thumbnail hover',
    volume: 0.6,
  },
  {
    frame: 2740,
    timestamp: '45.67s',
    stemId: 'sfx_bulk_action_tick',
    description: 'Multi-selection checkmark ticks across grouped dates',
    volume: 0.65,
  },

  // Scene 6: The Trust Pillars (Frames 2880–3360 | 48.0s – 56.0s)
  {
    frame: 2880,
    timestamp: '48.00s',
    stemId: 'sfx_reverse_suction_pull',
    description: 'Expansive camera pull-back into high-elevation glass arena',
    volume: 0.85,
  },
  {
    frame: 2960,
    timestamp: '49.33s',
    stemId: 'sfx_pillar_snap_1',
    description: 'Acoustic glass card impact for 100% Private & Local',
    volume: 0.8,
  },
  {
    frame: 3080,
    timestamp: '51.33s',
    stemId: 'sfx_pillar_snap_2',
    description:
      'Acoustic glass card impact for Completely Free (No Ads / Paywalls)',
    volume: 0.8,
  },
  {
    frame: 3200,
    timestamp: '53.33s',
    stemId: 'sfx_pillar_snap_3',
    description:
      'Acoustic glass card impact for Open-Source (Rust + Tauri + TypeScript)',
    volume: 0.8,
  },

  // Scene 7: Outro & Official Launch Lockup (Frames 3360–3600 | 56.0s – 60.0s)
  {
    frame: 3360,
    timestamp: '56.00s',
    stemId: 'sfx_outro_cinematic_riser',
    description:
      'Deep orchestral sub-bass riser transitioning into final hero lockup',
    volume: 0.9,
  },
  {
    frame: 3420,
    timestamp: '57.00s',
    stemId: 'sfx_badge_lock_dual',
    description:
      'Dual tactile latch click as GitHub and Chrome Web Store badges anchor',
    volume: 0.75,
  },
  {
    frame: 3490,
    timestamp: '58.17s',
    stemId: 'sfx_punchline_strike',
    description:
      'Triple crystalline acoustic strike for "Fast. Private. Transparent."',
    volume: 0.85,
  },
  {
    frame: 3570,
    timestamp: '59.50s',
    stemId: 'sfx_tail_reverb_fade',
    description:
      'Warm decaying acoustic reverb tail settling into silent completion',
    volume: 0.4,
  },
] as const;
