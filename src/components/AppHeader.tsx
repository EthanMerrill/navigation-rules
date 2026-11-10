import type {WindState} from "../model/world";

interface AppHeaderProps {
	wind: WindState;
	onWindChange: (direction: number) => void;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const PRESETS: Array<{label: string; direction: number}> = [
	{label: "N", direction: 0},
	{label: "E", direction: 90},
	{label: "S", direction: 180},
	{label: "W", direction: 270},
];

function compassLabel(direction: number): string {
	const idx = Math.round(direction / 45) % 8;
	return COMPASS_POINTS[idx];
}

const AppHeader = ({wind, onWindChange}: AppHeaderProps) => {
	return (
		<header className="app-header">
			<div className="control-bar">
				<div className="control-row">
					<span className="control-label">Wind from</span>
					<div className="wind-arrow" aria-label={`Wind blowing toward ${compassLabel((wind.direction + 180) % 360)}`} style={{transform: `rotate(${wind.direction}deg)`}}>
						↓
					</div>
					<input className="wind-slider" type="range" min={0} max={359} step={1} value={wind.direction} onChange={(e) => onWindChange(Number(e.target.value))} />
					<span className="wind-readout">
						{compassLabel(wind.direction)} {wind.direction}°
					</span>
					<div className="wind-presets">
						{PRESETS.map((preset) => (
							<button key={preset.label} type="button" className={`wind-preset${wind.direction === preset.direction ? " wind-preset--active" : ""}`} onClick={() => onWindChange(preset.direction)}>
								{preset.label}
							</button>
						))}
					</div>
				</div>
			</div>
		</header>
	);
};

export default AppHeader;
