import React from 'react';
import './SubtitleOverlay.css';

interface Subtitle {
    id: number;
    text: string;
    startTimeSeconds: number;
    endTimeSeconds: number;
    index: number;
}

interface SubtitleOverlayProps {
    subtitles: Subtitle[];
    currentTime: number;
}

const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles, currentTime }) => {
    // Find the currently active subtitle
    const activeSubtitle = subtitles.find(
        (sub) => currentTime >= sub.startTimeSeconds && currentTime <= sub.endTimeSeconds
    );

    if (!activeSubtitle) return null;

    return (
        <div className="subtitle-overlay">
            <span className="subtitle-text">
                {activeSubtitle.text}
            </span>
        </div>
    );
};

export default SubtitleOverlay;
