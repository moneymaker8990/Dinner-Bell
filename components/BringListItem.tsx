import { Avatar } from '@/components/Avatar';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackBringClaimed } from '@/lib/analytics';
import { hapticClaim } from '@/lib/haptics';
import { claimBringItem } from '@/lib/invite';
import { notifyHostBringClaimed } from '@/lib/notifyHost';
import type { BringItemRow } from '@/types/events';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppBottomSheet } from '@/components/AppBottomSheet';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import GorhomBottomSheet from '@gorhom/bottom-sheet';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

interface BringListItemProps {
  item: BringItemRow;
  eventId: string;
  guestId: string | null;
  guestName?: string;
  claimedByName?: string | null;
  onClaimed?: () => void;
}

export const BringListItem = React.memo(function BringListItem({ item, eventId, guestId, guestName, claimedByName, onClaimed }: BringListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();
  const claimSheetRef = useRef<GorhomBottomSheet>(null);
  const [quantity, setQuantity] = useState(item.quantity);
  const [claimMessage, setClaimMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClaimCelebration, setShowClaimCelebration] = useState(false);

  const canClaim = item.is_claimable && item.status === 'unclaimed' && guestId;

  const handleClaim = async () => {
    hapticClaim();
    setSubmitting(true);
    setError(null);
    const ok = await claimBringItem(item.id, guestId!, quantity, claimMessage.trim() || undefined);
    setSubmitting(false);
    if (ok) {
      trackBringClaimed(eventId, item.name);
      claimSheetRef.current?.close();
      setShowClaimCelebration(true);
      if (guestName) notifyHostBringClaimed(eventId, guestName, item.name).catch(() => {});
      onClaimed?.();
    } else {
      setError(Copy.bringList.alreadyClaimed);
    }
  };

  const statusText = item.status === 'provided' ? Copy.bringList.provided : item.status === 'claimed' ? Copy.bringList.claimed : Copy.bringList.unclaimed;
  const needLabel = item.is_required ? Copy.bringList.needed : Copy.bringList.optional;

  return (
    <>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            {item.status === 'claimed' && claimedByName && (
              <Avatar initials={initials(claimedByName)} size={28} style={styles.claimedAvatar} />
            )}
          </View>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.status}>{statusText}</Text>
            <Text style={styles.needLabel}> · {needLabel}</Text>
          </View>
        </View>
        {canClaim && (
          <Pressable
            style={[styles.claimBtn, { backgroundColor: colors.primaryButton }]}
            onPress={() => claimSheetRef.current?.snapToIndex(0)}
            accessibilityRole="button"
            accessibilityLabel="Claim this item"
          >
            <Text style={[styles.claimBtnText, { color: colors.primaryButtonText }]}>{Copy.bringList.illBringThis}</Text>
          </Pressable>
        )}
      </View>
      <AppBottomSheet
        ref={claimSheetRef}
        index={-1}
        snapPoints={['55%']}
        title={item.name}
        onClose={() => setError(null)}
      >
        <FloatingLabelInput
          label={Copy.bringList.quantityLabel}
          value={quantity}
          onChangeText={setQuantity}
          onClear={() => setQuantity('')}
          returnKeyType="next"
          style={{ marginBottom: spacing.lg }}
        />
        <FloatingLabelInput
          label={Copy.bringList.messageLabel}
          value={claimMessage}
          onChangeText={setClaimMessage}
          onClear={() => setClaimMessage('')}
          returnKeyType="done"
          multiline
          style={{ marginBottom: spacing.lg }}
        />
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <Pressable
          style={[styles.modalBtn, { backgroundColor: colors.primaryButton }, submitting && styles.modalBtnDisabled]}
          onPress={handleClaim}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitting ? 'Submitting claim' : 'Submit claim'}
        >
          <Text style={[styles.modalBtnText, { color: colors.primaryButtonText }]}>{submitting ? Copy.bringList.claiming : Copy.bringList.illBringThis}</Text>
        </Pressable>
        <Pressable
          style={styles.modalCancel}
          onPress={() => claimSheetRef.current?.close()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </Pressable>
      </AppBottomSheet>
      <CelebrationOverlay visible={showClaimCelebration} headline="Got it!" displayDuration={1500} onFinish={() => setShowClaimCelebration(false)} />
    </>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: typography.body, fontWeight: '500' },
  claimedAvatar: { marginLeft: spacing.xs },
  quantity: { fontSize: typography.meta, opacity: 0.8, marginTop: spacing.xs / 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs / 2 },
  status: { fontSize: typography.microLabel, opacity: 0.7 },
  needLabel: { fontSize: typography.microLabel, opacity: 0.6 },
  claimBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: spacing.sm },
  claimBtnText: { fontWeight: '600' },
  error: { marginBottom: spacing.sm },
  modalBtn: { padding: spacing.lg, borderRadius: radius.input, alignItems: 'center', marginBottom: spacing.sm },
  modalBtnText: { fontWeight: '600' },
  modalBtnDisabled: { opacity: 0.6 },
  modalCancel: { padding: spacing.md, alignItems: 'center' },
  modalCancelText: { fontWeight: '500' },
});
