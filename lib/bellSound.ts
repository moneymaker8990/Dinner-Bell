import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const BELL_SOUNDS: Record<string, string> = {
  triangle: 'https://assets.mixkit.co/active_storage/sfx/2572-ping-notification.mp3',
  chime: 'https://assets.mixkit.co/active_storage/sfx/2570-magic-chime.mp3',
  gong: 'https://assets.mixkit.co/active_storage/sfx/2568-minimal-gong-hit.mp3',
};

const soundCache: Record<string, Audio.Sound> = {};

export type BellSoundSlug = 'triangle' | 'chime' | 'gong';
export const DEFAULT_BELL_SOUND: BellSoundSlug = 'chime';

export async function playBellSound(soundSlug?: BellSoundSlug | string | null): Promise<void> {
  const slug = soundSlug && BELL_SOUNDS[soundSlug] ? soundSlug : DEFAULT_BELL_SOUND;
  const url = BELL_SOUNDS[slug] ?? BELL_SOUNDS[DEFAULT_BELL_SOUND];
  try {
    let sound = soundCache[slug];
    if (sound) {
      await sound.replayAsync();
    } else {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );
      soundCache[slug] = s;
      await s.getStatusAsync();
    }
  } catch (_) {
    // ignore
  }
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}
