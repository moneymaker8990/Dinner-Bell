import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

let sound: Audio.Sound | null = null;

const DING_URL = 'https://assets.mixkit.co/active_storage/sfx/2572-ping-notification.mp3';

export async function playBellSound(): Promise<void> {
  try {
    if (sound) {
      await sound.replayAsync();
    } else {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: DING_URL },
        { shouldPlay: true }
      );
      sound = s;
      await s.getStatusAsync();
    }
  } catch (_) {
    // ignore
  }
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}
