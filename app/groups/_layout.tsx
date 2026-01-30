import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, title: 'Guest groups' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
