import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { claimBringItem } from '@/lib/invite';
import { notifyHostBringClaimed } from '@/lib/notifyHost';
import type { BringItemRow } from '@/types/events';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput } from 'react-native';

interface BringListItemProps {
  item: BringItemRow;
  eventId: string;
  guestId: string | null;
  guestName?: string;
  onClaimed?: () => void;
}

export function BringListItem({ item, eventId, guestId, guestName, onClaimed }: BringListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [modalVisible, setModalVisible] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);
  const [claimMessage, setClaimMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canClaim = item.is_claimable && item.status === 'unclaimed' && guestId;

  const handleClaim = async () => {
    setSubmitting(true);
    setError(null);
    const ok = await claimBringItem(item.id, guestId!, quantity, claimMessage.trim() || undefined);
    setSubmitting(false);
    if (ok) {
      setModalVisible(false);
      if (guestName) notifyHostBringClaimed(eventId, guestName, item.name).catch(() => {});
      onClaimed?.();
    } else {
      setError('Already claimed by someone else');
    }
  };

  const statusText = item.status === 'provided' ? 'Provided' : item.status === 'claimed' ? 'Claimed' : 'Unclaimed';

  return (
    <>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <Text style={styles.status}>{statusText}</Text>
        </View>
        {canClaim && (
          <Pressable style={[styles.claimBtn, { backgroundColor: colors.primaryButton }]} onPress={() => setModalVisible(true)}>
            <Text style={[styles.claimBtnText, { color: colors.primaryButtonText }]}>I'll bring this</Text>
          </Pressable>
        )}
      </View>
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{item.name}</Text>
            <Text style={styles.label}>Quantity you'll bring</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder }]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 2 bottles"
              placeholderTextColor="#888"
            />
            <Text style={styles.label}>Optional message (e.g. "I can bring extra cups too")</Text>
            <TextInput
              style={[styles.input, styles.textArea, { borderColor: colors.inputBorder }]}
              value={claimMessage}
              onChangeText={setClaimMessage}
              placeholder="Optional"
              placeholderTextColor="#888"
              multiline
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.modalBtn, { backgroundColor: colors.primaryButton }, submitting && styles.modalBtnDisabled]}
              onPress={handleClaim}
              disabled={submitting}
            >
              <Text style={[styles.modalBtnText, { color: colors.primaryButtonText }]}>{submitting ? 'Claiming...' : "I'll bring this"}</Text>
            </Pressable>
            <Pressable style={styles.modalCancel} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500' },
  quantity: { fontSize: 14, opacity: 0.8, marginTop: 2 },
  status: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  claimBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  claimBtnText: { fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  textArea: { minHeight: 60 },
  error: { color: '#c00', marginBottom: 8 },
  modalBtn: { padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  modalBtnText: { fontWeight: '600' },
  modalBtnDisabled: { opacity: 0.6 },
  modalCancel: { padding: 12, alignItems: 'center' },
  modalCancelText: { fontWeight: '500' },
});
