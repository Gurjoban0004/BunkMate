export const getGreeting = (name, devDate = null) => {
    const now = devDate ? new Date(devDate) : new Date();
    const hour = now.getHours();
    let greeting;
    let emoji;

    if (hour >= 5 && hour < 12) {
        greeting = 'Good morning';
        emoji = '☀️';
    } else if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon';
        emoji = '🌤️';
    } else if (hour >= 17 && hour < 21) {
        greeting = 'Good evening';
        emoji = '🌅';
    } else {
        greeting = 'Good night';
        emoji = '🌙';
    }

    return {
        text: `${greeting}, ${name}!`,
        emoji,
    };
};
