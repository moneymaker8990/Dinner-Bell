ALTER TABLE public.bring_items ADD COLUMN IF NOT EXISTS claim_message TEXT;

CREATE OR REPLACE FUNCTION public.claim_bring_item(
  p_bring_item_id UUID,
  p_guest_id UUID,
  p_claimed_quantity TEXT DEFAULT NULL,
  p_claim_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_event_id UUID;
  v_claimable BOOLEAN;
  v_current_status bring_item_status;
BEGIN
  SELECT bi.event_id, bi.is_claimable, bi.status INTO v_event_id, v_claimable, v_current_status
  FROM public.bring_items bi
  WHERE bi.id = p_bring_item_id;
  IF v_event_id IS NULL THEN RETURN false; END IF;
  IF NOT v_claimable THEN RETURN false; END IF;
  IF v_current_status != 'unclaimed' THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_guests WHERE id = p_guest_id AND event_id = v_event_id) THEN
    RETURN false;
  END IF;
  UPDATE public.bring_items
  SET claimed_by_guest_id = p_guest_id,
      claimed_quantity = COALESCE(p_claimed_quantity, quantity),
      claim_message = p_claim_message,
      status = 'claimed',
      updated_at = now()
  WHERE id = p_bring_item_id AND status = 'unclaimed';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_bring_item(UUID, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_bring_item(UUID, UUID, TEXT, TEXT) TO authenticated;
