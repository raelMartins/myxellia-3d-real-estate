'use client';

import { useId } from 'react';

export function EngineBannerLogo() {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const clip0 = `engine-banner-clip0-${uid}`;
    const clip1 = `engine-banner-clip1-${uid}`;

    return (
        <svg
            width={33}
            height={32}
            viewBox="0 0 33 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden
        >
            <g clipPath={`url(#${clip0})`}>
                <g clipPath={`url(#${clip1})`}>
                    <path
                        d="M36.1649 -4.03711H24.9075V7.20483H36.1649V-4.03711Z"
                        fill="black"
                    />
                    <path
                        d="M24.9082 24.8931V7.34962L35.1259 17.6252C35.7712 18.3054 36.1297 19.2005 36.2014 20.1314V36.2427H-3.80859V-4H12.2171C13.1492 -3.9642 14.0455 -3.57036 14.7266 -2.92591L24.9443 7.34962H7.52031V24.8931H24.9082Z"
                        fill="black"
                    />
                </g>
            </g>
            <defs>
                <clipPath id={clip0}>
                    <rect width="32.4267" height="32" fill="white" />
                </clipPath>
                <clipPath id={clip1}>
                    <rect
                        width="39.9743"
                        height="40.2426"
                        fill="white"
                        transform="translate(-3.81128 -4.03613)"
                    />
                </clipPath>
            </defs>
        </svg>
    );
}
