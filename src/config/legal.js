/**
 * The terms a student accepts by finishing onboarding, and the privacy notice
 * that goes with them.
 *
 * These live as data, not as JSX, so the same words appear in the onboarding
 * sheet and in Settings, and so a change is one edit in one place.
 *
 * LAST_UPDATED is shown to the student and is what tells you whether the copy
 * they accepted is the copy you are reading. Bump it whenever the text below
 * changes in substance.
 *
 * ponytail: these are a careful plain-English draft, not lawyer-reviewed. Have
 * counsel read them before the app is listed publicly — the liability and
 * jurisdiction sections in particular.
 */

export const LEGAL_LAST_UPDATED = '8 September 2026';
export const LEGAL_CONTACT = 'gurjobanpanjeta@gmail.com';

export const TERMS = {
    title: 'Terms of Use',
    updated: LEGAL_LAST_UPDATED,
    sections: [
        {
            heading: 'What Presence is',
            body:
                'Presence is a student-built app that signs in to our college ERP on your behalf, reads the attendance and timetable it already holds for you, and presents them so you can see where you stand.\n\n' +
                'It is an independent project. It is not made, endorsed, operated or approved by the college, and it is not an official college service.',
        },
        {
            heading: 'Your college account',
            body:
                'To use Presence you sign in with your own college ID and password. You may only use credentials that belong to you.\n\n' +
                'Your password is passed straight to the college portal to obtain a session and is never stored on our servers. Presence keeps an encrypted session token so it can refresh your attendance without asking you to sign in again, and that token is held in your device’s secure storage.\n\n' +
                'If the college signs the app out, or you change your password, Presence will ask you to sign in again.',
        },
        {
            heading: 'The numbers are the college’s, not ours',
            body:
                'Every attendance figure in Presence comes from our college’s own records. Presence does not mark attendance, cannot change it, and cannot correct it.\n\n' +
                'Projections, skip budgets and "safe to skip" verdicts are arithmetic on those records. They are estimates offered to help you plan, not guarantees. Attendance rules, cutoffs, medical exemptions and detention decisions are set and applied by the college.\n\n' +
                'Do not rely on Presence alone for a decision that matters. The college’s own portal is the authority. If the two disagree, the college is right.',
        },
        {
            heading: 'Fair use',
            body:
                'Please use Presence for your own attendance only. Do not attempt to access another student’s data, automate or script the app, overload the college’s systems through it, or resell or redistribute it.\n\n' +
                'Access may be suspended if an account is used in a way that risks harm to other students or to the college’s systems.',
        },
        {
            heading: 'Availability',
            body:
                'Presence depends entirely on the college’s portal. When the portal is slow, down, or changes how it works, Presence may show stale data or stop syncing until it is fixed.\n\n' +
                'The app is provided as it is, with no promise of uninterrupted service. To the extent the law allows, the maker of Presence is not liable for any loss arising from its use, including attendance shortfall, missed classes or academic penalty.',
        },
        {
            heading: 'Ending it',
            body:
                'You can disconnect our college account from Settings at any time, which stops all syncing and clears the stored sign-in from your device. Deleting the app removes the local copy of your data.\n\n' +
                'To have the cloud copy deleted as well, use "Delete my data" in Settings, or write to ' + LEGAL_CONTACT + '.',
        },
        {
            heading: 'Changes',
            body:
                'These terms may change as the app changes. The version shown here, with its date, is the one that applies. Continuing to use Presence after an update means accepting the updated terms.',
        },
    ],
};

export const PRIVACY = {
    title: 'Privacy',
    updated: LEGAL_LAST_UPDATED,
    sections: [
        {
            heading: 'What is stored',
            body:
                'Your roll number and name as the college reports them, the attendance and timetable read from the portal, the settings you choose in the app, and a record of when the app signed in and last synced.\n\n' +
                'Your college password is not stored. Session tokens are encrypted and kept in your device’s secure storage.',
        },
        {
            heading: 'Where it lives',
            body:
                'On your device, and in a private cloud copy so a reinstall or a second device can pick up where you left off. The cloud copy is scoped to your account: the security rules let a device read and write only its own data.',
        },
        {
            heading: 'What the maker can see',
            body:
                'An admin view shows who has signed in, when they last used the app, aggregate attendance across students, and technical health such as sync failures. This exists to keep the app working and to know when the college portal breaks.\n\n' +
                'IP addresses are never stored in readable form — only a one-way hash, which is enough to tell one network from another and not enough to recover the address.',
        },
        {
            heading: 'What is never done',
            body:
                'Your data is not sold, and it is not shared with advertisers or with any third party outside the services needed to run the app (hosting and the database). Nothing is shared with the college beyond the sign-in the college already sees.',
        },
        {
            heading: 'Research data',
            body:
                'Aggregate, subject-level attendance figures may be used for an academic project on attendance patterns. Those records carry a course code and numbers — not your name, your roll number, or your day-by-day marks.',
        },
        {
            heading: 'Getting it removed',
            body:
                'Disconnecting the college account in Settings stops all collection. "Delete my data" removes the cloud copy. For anything else, write to ' + LEGAL_CONTACT + '.',
        },
    ],
};

export const LEGAL_DOCS = { terms: TERMS, privacy: PRIVACY };
