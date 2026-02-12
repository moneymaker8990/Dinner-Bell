# Release Checklist

## Smoke Tests (by role)

### Host (signed-in)
- [ ] Create event end-to-end (all 6 steps)
- [ ] Publish success screen shows "Invite now" CTA
- [ ] Edit event
- [ ] Duplicate event (from recap "Host this again")
- [ ] Ring bell (haptic + sound)
- [ ] Invite guest (email, phone, contacts, share link)
- [ ] View bring list progress
- [ ] Mark bring item as provided
- [ ] Cancel event
- [ ] View recap after event ends

### Guest (signed-in)
- [ ] Open invite link → RSVP going/late/maybe/can't
- [ ] Claim bring item
- [ ] Navigate to event location
- [ ] Share ETA / mark arrived
- [ ] Open event chat
- [ ] View recap

### Guest (anonymous / not signed in)
- [ ] Open invite link → RSVP with name + contact
- [ ] View event detail via guestId param
- [ ] Deep link one-tap RSVP

### Waitlist
- [ ] Join waitlist when event is full
- [ ] See "on the waitlist" confirmation

## Regression Tests
- [ ] `create_event` RPC works with all parameters
- [ ] Invite links work (share, open, RSVP)
- [ ] Bell sound plays on trigger
- [ ] Haptics fire for RSVP, claim, bell, tap, success
- [ ] Push notifications scheduled (2h, 30m, bell)
- [ ] Deep links route correctly (invite, event, bell)
- [ ] Invalid deep links show toast + redirect to home

## Cross-Platform
- [ ] iOS: all flows
- [ ] Android: all flows
- [ ] Web: all flows, responsive breakpoints
- [ ] Dark mode: all screens
- [ ] Light mode: all screens

## Performance
- [ ] No jank on hero animation (low-end Android)
- [ ] Skeleton loaders show during data fetch
- [ ] Offline banner appears when disconnected (web)

## Analytics
- [ ] `create_start` fires on create screen mount
- [ ] `create_step_completed` fires on each Next
- [ ] `create_published` fires on successful publish
- [ ] `invite_opened` fires when invite loads
- [ ] `rsvp_submitted` fires on RSVP
- [ ] `share_initiated` fires on share

## Design QA
- [ ] Run `docs/design-qa.md` audit commands — no violations
- [ ] Run `docs/accessibility-checklist.md` — all items pass
- [ ] No raw hex in `app/` or `components/`

## Legal & Support
- [ ] Privacy policy link accessible
- [ ] Terms of service link accessible
- [ ] Contact support surface exists

## Feature Flags / Staged Rollout
- [ ] Premium features gated behind `PremiumGate`
- [ ] Free users have full core utility
- [ ] Rollback criteria documented
