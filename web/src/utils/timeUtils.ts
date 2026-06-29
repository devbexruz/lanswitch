/**
 * C# TimeSpan formatini (masalan: "00:00:03.1000000" yoki "00:00:05") soniyalarga (3.1) aylantiradi.
 */
export const parseTimeSpanToSeconds = (timeSpanStr: string | null | undefined): number => {
    if (!timeSpanStr) return 0;

    // Ba'zida API TimeSpan o'rniga faqat sonlar yoki to'liq bo'lmagan string qaytarishi mumkin.
    // Format: hh:mm:ss.fffffff yoki dd.hh:mm:ss.fffffff
    try {
        let timePart = timeSpanStr;
        let days = 0;

        // Agar kun qismi bo'lsa (masalan: 1.02:30:45.000)
        if (timeSpanStr.includes('.') && timeSpanStr.indexOf('.') < timeSpanStr.indexOf(':')) {
            const parts = timeSpanStr.split('.');
            days = parseInt(parts[0], 10);
            timePart = parts.slice(1).join('.');
        }

        const timeParts = timePart.split(':');
        if (timeParts.length < 3) return 0;

        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        const secondsPart = timeParts[2];
        let seconds = 0;
        let milliseconds = 0;

        if (secondsPart.includes('.')) {
            const secParts = secondsPart.split('.');
            seconds = parseInt(secParts[0], 10);
            // Soniya qoldiqlari (milliseconds/microseconds)
            // ".1000000" -> 0.1 sekund
            milliseconds = parseFloat('0.' + secParts[1]);
        } else {
            seconds = parseInt(secondsPart, 10);
        }

        return (days * 86400) + (hours * 3600) + (minutes * 60) + seconds + milliseconds;
    } catch (e) {
        console.error("Error parsing timeSpan:", timeSpanStr, e);
        return 0;
    }
};

/**
 * Soniyalarni pleyerda ko'rsatish uchun chiroyli string (MM:SS) ga aylantiradi.
 */
export const formatSecondsToMMSS = (seconds: number): string => {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
