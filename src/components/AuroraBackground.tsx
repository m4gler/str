import React from 'react';

export default function AuroraBackground() {
    return (
        <div className="absolute top-0 left-0 w-full h-screen overflow-hidden flex justify-center items-end bg-transparent z-0 pointer-events-none aurora-mask transform-gpu">
            <img
                src="/circle/rectangle_10_1x.webp"
                alt=""
                className="absolute top-100 left-0 w-50 h-50 border-none transform-gpu animate-aurora-breathe select-none drag-none"
                style={{ animationDelay: '0s', animationDuration: '15s' }}
            />
            <img
                src="/circle/rectangle_11_1x.webp"
                alt=""
                className="absolute top-0 left-0 w-5 h-5 border-none transform-gpu animate-aurora-breathe select-none drag-none"
                style={{ animationDelay: '-5s', animationDuration: '20s' }}
            />
        </div>
    );
}
