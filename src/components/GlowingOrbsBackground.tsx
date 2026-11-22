import React from 'react';

export default function GlowingOrbsBackground() {
    // Generate static orbs to ensure consistent server/client rendering
    // or use strict positioning. 
    // We'll manually specify a pleasing arrangement to match the "designed" look of the image.

    const orbs = [
        // Left Column
        { key: 'l1', top: '5%', left: '-5%', width: '300px', height: '300px', color: '#00C8FF', opacity: 0.15, blur: '80px', anim: 'slow', delay: '0s' },
        { key: 'l2', top: '20%', left: '5%', width: '200px', height: '200px', color: '#0B9DF7', opacity: 0.1, blur: '60px', anim: 'medium', delay: '1s' },
        { key: 'l3', top: '35%', left: '-8%', width: '250px', height: '250px', color: '#00C8FF', opacity: 0.12, blur: '70px', anim: 'fast', delay: '2s' },
        { key: 'l4', top: '50%', left: '2%', width: '180px', height: '180px', color: '#0B9DF7', opacity: 0.1, blur: '50px', anim: 'slow', delay: '0.5s' },
        { key: 'l5', top: '65%', left: '-6%', width: '280px', height: '280px', color: '#00C8FF', opacity: 0.15, blur: '80px', anim: 'medium', delay: '1.5s' },
        { key: 'l6', top: '80%', left: '4%', width: '220px', height: '220px', color: '#0B9DF7', opacity: 0.12, blur: '60px', anim: 'fast', delay: '0.2s' },
        { key: 'l7', top: '95%', left: '-4%', width: '260px', height: '260px', color: '#00C8FF', opacity: 0.1, blur: '70px', anim: 'slow', delay: '2.5s' },

        // Right Column
        { key: 'r1', top: '10%', right: '-5%', width: '280px', height: '280px', color: '#0B9DF7', opacity: 0.15, blur: '80px', anim: 'medium', delay: '0.5s' },
        { key: 'r2', top: '25%', right: '5%', width: '190px', height: '190px', color: '#00C8FF', opacity: 0.1, blur: '50px', anim: 'fast', delay: '1.5s' },
        { key: 'r3', top: '40%', right: '-8%', width: '320px', height: '320px', color: '#0B9DF7', opacity: 0.12, blur: '90px', anim: 'slow', delay: '0s' },
        { key: 'r4', top: '55%', right: '3%', width: '210px', height: '210px', color: '#00C8FF', opacity: 0.1, blur: '60px', anim: 'medium', delay: '2s' },
        { key: 'r5', top: '70%', right: '-6%', width: '290px', height: '290px', color: '#0B9DF7', opacity: 0.15, blur: '80px', anim: 'fast', delay: '1s' },
        { key: 'r6', top: '85%', right: '2%', width: '240px', height: '240px', color: '#00C8FF', opacity: 0.12, blur: '70px', anim: 'slow', delay: '0.8s' },
        { key: 'r7', top: '98%', right: '-5%', width: '270px', height: '270px', color: '#0B9DF7', opacity: 0.1, blur: '75px', anim: 'medium', delay: '1.8s' },
    ];

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#050505] z-0 pointer-events-none">
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0); opacity: 0.1; }
                    50% { transform: translate(0, -20px); opacity: 0.2; }
                }
                .animate-float-slow { animation: float 15s ease-in-out infinite; }
                .animate-float-medium { animation: float 10s ease-in-out infinite; }
                .animate-float-fast { animation: float 7s ease-in-out infinite; }
            `}</style>

            {orbs.map((orb) => (
                <div
                    key={orb.key}
                    className={`absolute rounded-full animate-float-${orb.anim}`}
                    style={{
                        top: orb.top,
                        left: orb.left,
                        right: orb.right,
                        width: orb.width,
                        height: orb.height,
                        backgroundColor: orb.color,
                        filter: `blur(${orb.blur})`,
                        opacity: orb.opacity,
                        animationDelay: orb.delay,
                    }}
                />
            ))}
        </div>
    );
}
