import { FunctionDeclaration, Type } from '@google/genai';

export interface AlarmItem {
  id: string;
  time: string;
  label: string;
  active: boolean;
}

export interface ActionLogItem {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  launchUri?: string;
}

export interface PhoneState {
  wifi: boolean;
  bluetooth: boolean;
  flashlight: boolean;
  dnd: boolean;
  mobileData: boolean;
  location: boolean;
  autoRotate: boolean;
  airplaneMode: boolean;
  hotspot: boolean;
  batterySaver: boolean;
  brightness: number;
  volume: number;
  batteryLevel: number;
  batteryCharging: boolean;
  activeApp: string;
  musicPlaying: boolean;
  currentTrack: string;
  lastCall: string | null;
  lastMessage: { recipient: string; text: string } | null;
  alarms: AlarmItem[];
}

export const INITIAL_PHONE_STATE: PhoneState = {
  wifi: true,
  bluetooth: false,
  flashlight: false,
  dnd: false,
  mobileData: true,
  location: true,
  autoRotate: true,
  airplaneMode: false,
  hotspot: false,
  batterySaver: false,
  brightness: 68,
  volume: 60,
  batteryLevel: 84,
  batteryCharging: false,
  activeApp: 'Jassi Home',
  musicPlaying: false,
  currentTrack: 'Kesariya — Arijit Singh',
  lastCall: null,
  lastMessage: null,
  alarms: [
    { id: 'alarm-1', time: '07:00', label: 'Morning Wake Up', active: true },
  ],
};

export interface ExecutedAction {
  tool: string;
  summary: string;
  launchUri?: string;
  vibrateMs?: number;
}

export const DEVICE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'toggleSystemSetting',
    description:
      'Turn phone system toggles ON or OFF: wifi, bluetooth, flashlight, dnd (do not disturb / silent), mobileData, location, autoRotate, airplaneMode, hotspot, batterySaver.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        setting: {
          type: Type.STRING,
          description:
            'One of: wifi, bluetooth, flashlight, dnd, mobileData, location, autoRotate, airplaneMode, hotspot, batterySaver',
        },
        enabled: {
          type: Type.BOOLEAN,
          description: 'true to turn ON, false to turn OFF',
        },
      },
      required: ['setting', 'enabled'],
    },
  },
  {
    name: 'adjustLevel',
    description: 'Set phone screen brightness or speaker volume level from 0 to 100.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          description: 'Either "brightness" or "volume"',
        },
        level: {
          type: Type.NUMBER,
          description: 'Percentage between 0 and 100',
        },
      },
      required: ['target', 'level'],
    },
  },
  {
    name: 'openApp',
    description:
      'Open ANY application on the phone: YouTube, WhatsApp, Instagram, Camera, Maps, Spotify, Chrome, Settings, Gallery, Clock, Phone, Messages, Calculator, Calendar, Gmail, Telegram, Snapchat, Files, PlayStore.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appName: {
          type: Type.STRING,
          description: 'Name of the app to open (e.g., YouTube, WhatsApp, Maps, Spotify, Camera, Settings)',
        },
        query: {
          type: Type.STRING,
          description: 'Optional search query, song, video, or destination to pass to the app',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'makeCall',
    description: 'Place a direct phone call to a contact name (resolved from Contacts) or phone number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactOrNumber: {
          type: Type.STRING,
          description: 'Contact name (e.g. Mummy, Rahul) or phone number',
        },
      },
      required: ['contactOrNumber'],
    },
  },
  {
    name: 'sendMessage',
    description: 'Draft or send a message via WhatsApp or SMS to a contact name or phone number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        recipient: {
          type: Type.STRING,
          description: 'Recipient name or phone number',
        },
        messageText: {
          type: Type.STRING,
          description: 'The message content to send',
        },
        platform: {
          type: Type.STRING,
          description: 'Either "whatsapp" or "sms"',
        },
      },
      required: ['recipient', 'messageText'],
    },
  },
  {
    name: 'setAlarmOrTimer',
    description: 'Set an alarm for a specific time (HH:MM 24h) OR set a countdown timer in minutes/seconds.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        time: {
          type: Type.STRING,
          description: 'Alarm time in HH:MM format (e.g., 07:00, 18:30) or timer duration like "5m"',
        },
        label: {
          type: Type.STRING,
          description: 'Label for the alarm or timer',
        },
        timerSeconds: {
          type: Type.NUMBER,
          description: 'Optional countdown timer duration in seconds (e.g. 300 for 5 minutes)',
        },
      },
      required: ['time', 'label'],
    },
  },
  {
    name: 'controlMedia',
    description: 'Play, pause, skip next, or go previous track on the phone media player.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'One of: play, pause, next, previous',
        },
        trackName: {
          type: Type.STRING,
          description: 'Optional song name to play',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'searchWebOrMaps',
    description: 'Search Google, find places/directions on Maps, or open any website URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description: 'One of: google, maps, youtube, url',
        },
        query: {
          type: Type.STRING,
          description: 'Search query, destination, or full https URL',
        },
      },
      required: ['mode', 'query'],
    },
  },
  {
    name: 'takePhotoOrVideo',
    description: 'Open phone Camera to take a photo, selfie, or record video.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description: 'One of: photo, selfie, video',
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'performScreenGesture',
    description:
      'Execute A-to-Z Android Accessibility navigation, touch, or text input gestures across ANY app on screen: home, back, recents, notifications, quick_settings, split_screen, power_dialog, scroll_down, scroll_up, swipe_left, swipe_right, screenshot, lock_screen, tap_text, type_text.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        gesture: {
          type: Type.STRING,
          description:
            'One of: home, back, recents, notifications, quick_settings, split_screen, power_dialog, scroll_down, scroll_up, swipe_left, swipe_right, screenshot, lock_screen, tap_text, type_text',
        },
        targetText: {
          type: Type.STRING,
          description: 'When gesture is tap_text or type_text, the visible UI text to tap or text to type',
        },
      },
      required: ['gesture'],
    },
  },
];

const APP_DEEP_LINKS: Record<string, (q?: string) => string> = {
  youtube: (q) =>
    q ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` : 'https://www.youtube.com',
  whatsapp: (q) =>
    q ? `https://wa.me/?text=${encodeURIComponent(q)}` : 'https://wa.me/',
  maps: (q) =>
    q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : 'https://maps.google.com',
  spotify: (q) =>
    q ? `https://open.spotify.com/search/${encodeURIComponent(q)}` : 'https://open.spotify.com',
  instagram: () => 'https://www.instagram.com',
  chrome: (q) =>
    q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : 'https://www.google.com',
  gmail: () => 'https://mail.google.com',
  telegram: () => 'https://web.telegram.org',
};

export function executeDeviceTool(
  name: string,
  args: Record<string, unknown>,
  state: PhoneState
): { nextState: PhoneState; action: ExecutedAction; toolResult: Record<string, unknown> } {
  const next: PhoneState = {
    ...state,
    alarms: [...state.alarms],
  };

  if (name === 'toggleSystemSetting') {
    const setting = String(args.setting || '').trim();
    const enabled = Boolean(args.enabled);
    const validKeys = [
      'wifi',
      'bluetooth',
      'flashlight',
      'dnd',
      'mobileData',
      'location',
      'autoRotate',
      'airplaneMode',
      'hotspot',
      'batterySaver',
    ] as const;

    if (validKeys.includes(setting as (typeof validKeys)[number])) {
      const key = setting as (typeof validKeys)[number];
      next[key] = enabled;
      if (key === 'airplaneMode' && enabled) {
        next.wifi = false;
        next.mobileData = false;
        next.bluetooth = false;
        next.hotspot = false;
      }
      return {
        nextState: next,
        action: {
          tool: name,
          summary: `${setting} turned ${enabled ? 'ON' : 'OFF'}`,
          vibrateMs: 40,
        },
        toolResult: { success: true, setting, enabled },
      };
    }
    return {
      nextState: next,
      action: { tool: name, summary: `Checked ${setting}` },
      toolResult: { success: false, error: `Unknown setting: ${setting}` },
    };
  }

  if (name === 'adjustLevel') {
    const target = String(args.target || 'brightness');
    const level = Math.max(0, Math.min(100, Math.round(Number(args.level ?? 50))));
    if (target === 'volume') {
      next.volume = level;
    } else {
      next.brightness = level;
    }
    return {
      nextState: next,
      action: {
        tool: name,
        summary: `${target === 'volume' ? 'Volume' : 'Brightness'} set to ${level}%`,
        vibrateMs: 30,
      },
      toolResult: { success: true, target, level },
    };
  }

  if (name === 'openApp') {
    const appName = String(args.appName || 'Home');
    const query = args.query ? String(args.query) : undefined;
    next.activeApp = appName;
    const key = appName.toLowerCase().trim();
    const linkBuilder = APP_DEEP_LINKS[key];
    const launchUri = linkBuilder ? linkBuilder(query) : undefined;

    return {
      nextState: next,
      action: {
        tool: name,
        summary: query ? `Opened ${appName} (${query})` : `Opened ${appName}`,
        launchUri,
        vibrateMs: 45,
      },
      toolResult: { success: true, appName, query: query || null, deepLinkReady: Boolean(launchUri) },
    };
  }

  if (name === 'makeCall') {
    const contactOrNumber = String(args.contactOrNumber || 'Contact');
    next.lastCall = contactOrNumber;
    next.activeApp = 'Phone';
    const digits = contactOrNumber.replace(/[^+\d]/g, '');
    const launchUri = digits.length >= 3 ? `tel:${digits}` : `tel:${encodeURIComponent(contactOrNumber)}`;
    return {
      nextState: next,
      action: {
        tool: name,
        summary: `Calling ${contactOrNumber}`,
        launchUri,
        vibrateMs: 80,
      },
      toolResult: { success: true, calling: contactOrNumber, telUri: launchUri },
    };
  }

  if (name === 'sendMessage') {
    const recipient = String(args.recipient || 'Contact');
    const text = String(args.messageText || '');
    const platform = String(args.platform || 'whatsapp').toLowerCase();
    next.lastMessage = { recipient, text };
    next.activeApp = platform === 'sms' ? 'Messages' : 'WhatsApp';

    const digits = recipient.replace(/[^+\d]/g, '');
    const launchUri =
      platform === 'sms'
        ? `sms:${digits}?body=${encodeURIComponent(text)}`
        : digits.length >= 6
          ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
          : `https://wa.me/?text=${encodeURIComponent(text)}`;

    return {
      nextState: next,
      action: {
        tool: name,
        summary: `Prepared ${platform === 'sms' ? 'SMS' : 'WhatsApp'} to ${recipient}`,
        launchUri,
        vibrateMs: 50,
      },
      toolResult: { success: true, recipient, platform, text },
    };
  }

  if (name === 'setAlarmOrTimer') {
    const time = String(args.time || '07:30');
    const label = String(args.label || 'Jassi Reminder');
    const timerSeconds = args.timerSeconds ? Number(args.timerSeconds) : undefined;
    const id = `alarm-${Date.now()}`;
    next.alarms.unshift({ id, time, label, active: true });
    return {
      nextState: next,
      action: {
        tool: name,
        summary: timerSeconds
          ? `Timer set: ${timerSeconds}s · ${label}`
          : `Alarm set for ${time} · ${label}`,
        vibrateMs: 50,
      },
      toolResult: { success: true, time, label, timerSeconds: timerSeconds || null },
    };
  }

  if (name === 'controlMedia') {
    const action = String(args.action || 'play').toLowerCase();
    const trackName = args.trackName ? String(args.trackName) : undefined;
    if (action === 'pause') {
      next.musicPlaying = false;
    } else {
      next.musicPlaying = true;
      if (trackName) {
        next.currentTrack = trackName;
      } else if (action === 'next') {
        next.currentTrack = 'Apna Bana Le — Arijit Singh';
      } else if (action === 'previous') {
        next.currentTrack = 'Tum Hi Ho — Arijit Singh';
      }
    }
    return {
      nextState: next,
      action: {
        tool: name,
        summary: next.musicPlaying
          ? `Playing ${next.currentTrack}`
          : `Paused ${next.currentTrack}`,
        vibrateMs: 35,
      },
      toolResult: {
        success: true,
        musicPlaying: next.musicPlaying,
        currentTrack: next.currentTrack,
      },
    };
  }

  if (name === 'searchWebOrMaps') {
    const mode = String(args.mode || 'google').toLowerCase();
    const query = String(args.query || '');
    const launchUri =
      mode === 'maps'
        ? `https://maps.google.com/?q=${encodeURIComponent(query)}`
        : mode === 'youtube'
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          : mode === 'url' && query.startsWith('http')
            ? query
            : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    next.activeApp = mode === 'maps' ? 'Maps' : mode === 'youtube' ? 'YouTube' : 'Chrome';
    return {
      nextState: next,
      action: {
        tool: name,
        summary: `Search (${mode}): ${query}`,
        launchUri,
        vibrateMs: 35,
      },
      toolResult: { success: true, mode, query, launchUri },
    };
  }

  if (name === 'takePhotoOrVideo') {
    const mode = String(args.mode || 'photo').toLowerCase();
    next.activeApp = 'Camera';
    return {
      nextState: next,
      action: {
        tool: name,
        summary: `Camera ready (${mode})`,
        vibrateMs: 40,
      },
      toolResult: { success: true, mode },
    };
  }

  if (name === 'performScreenGesture') {
    const gesture = String(args.gesture || 'home');
    const targetText = args.targetText ? String(args.targetText) : undefined;
    if (gesture === 'home') {
      next.activeApp = 'Jassi Home';
    }
    return {
      nextState: next,
      action: {
        tool: name,
        summary: targetText
          ? gesture === 'type_text'
            ? `Typed "${targetText}"`
            : `Tapped "${targetText}"`
          : `Gesture: ${gesture.replace('_', ' ')}`,
        vibrateMs: 30,
      },
      toolResult: { success: true, gesture, targetText: targetText || null },
    };
  }

  return {
    nextState: next,
    action: { tool: name, summary: `Executed ${name}` },
    toolResult: { success: true },
  };
}
