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
        greeting = 'Hello';
        emoji = '👋';
    }

    // Extract first name only (e.g. "GURJOBAN SINGH" -> "Gurjoban")
    const firstName = (name || 'there').trim().split(/\s+/)[0];
    const titleName = firstName
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

    return {
        text: `${greeting}, ${titleName}`,
        emoji,
    };
};

