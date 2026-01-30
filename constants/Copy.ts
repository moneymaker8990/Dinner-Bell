/** Centralized friendly microcopy for premium feel */

export const Copy = {
  recap: {
    thanks: 'Thanks for coming',
    whoCame: 'Who came',
    whatWasBrought: 'What was brought',
    doThisAgain: 'Do this again',
    backToEvent: 'Back to event',
  },
  event: {
    dinnerIsOn: "Dinner is on",
    bellIn: (countdown: string) => `Bell in ${countdown}`,
    bellTimePassed: 'Bell time passed',
    hostedBy: (name: string) => `Hosted by ${name}`,
    tableAlmostReady: "Table's almost ready",
    bringListLookingGood: 'Bring list looking good',
  },
  invite: {
    eventFull: 'This event is full',
    joinWaitlist: 'Join the waitlist',
    onWaitlist: "You're on the waitlist. We'll notify you if a spot opens up.",
  },
  create: {
    almostThere: 'Almost there!',
    createAndSend: 'Create & Send',
  },
} as const;
