# Rollback Criteria

Use this doc when deciding whether to pause rollout, halt release, or roll back.

## Trigger thresholds

Roll back or pause release if any of these happen within the first 24 hours of rollout:

- Crash-free sessions drop below 99.0%
- Login/sign-in failure rate exceeds 3%
- RSVP submissions fail for more than 2% of attempts
- Invite links/deep links fail to open for more than 1% of attempts
- Push notification delivery is severely degraded for bell/reminder notifications
- Data integrity issue appears (lost event data, incorrect guest list mutations, duplicate critical writes)

## Severity levels

- **Sev 1 (Immediate rollback):** data loss, auth outage, critical crash loop, broken core host/guest flow
- **Sev 2 (Stop rollout + hotfix):** major feature failure with workaround unavailable
- **Sev 3 (Continue staged rollout + patch):** non-blocking defects with low impact

## Rollback actions

### App Store (iOS)

- Stop phased release (if enabled)
- Remove app from sale only if issue is severe and widespread
- Submit expedited hotfix build if required

### Google Play (Android)

- Halt staged rollout immediately
- Roll users back to prior stable release track if applicable
- Promote prior stable artifact while hotfix is prepared

## Operational steps

1. Declare incident owner in release channel
2. Capture timeline and scope (platform, version, affected flow)
3. Execute platform rollback action(s)
4. Verify health metrics return to baseline
5. Publish post-incident summary with root cause and prevention actions

## Owners

- Release owner: product/engineering lead for current release
- Incident commander: on-call engineer
- Communications owner: person posting status updates to testers/stakeholders
