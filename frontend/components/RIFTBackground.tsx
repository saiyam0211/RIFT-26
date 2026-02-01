import LightRays from '../src/components/LightRays';

export default function RIFTBackground() {
    return (
        <div className="absolute inset-0 -z-10 bg-[#060010]">
            <LightRays
                raysOrigin="top-left"
                raysColor="#c0211f"
                raysSpeed={1}
                lightSpread={0.5}
                rayLength={3.5}
                pulsating
                fadeDistance={1}
                saturation={1}
                followMouse
                mouseInfluence={0.1}
                noiseAmount={0}
                distortion={0}
            />
        </div>
    );
}
