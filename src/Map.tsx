import { Coordinates } from 'msfs-geo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapParameters } from './MapParameters';
import { OverpassElement, WayOverpassElement } from './Query';

interface MapProps {
    elements: OverpassElement[];
    latitude: number;
    longitude: number;
    heading: number;
}

export const Map = ({ elements, latitude, longitude, heading }: MapProps) => {
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    const WIDTH = 1000;
    const HEIGHT = 1000;

    const params = useRef(new MapParameters());

    const ways = useMemo(() => elements.filter((it) => it.type === 'way') as WayOverpassElement[], [elements]);

    const aprons = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'apron'), [ways]);

    const taxiways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'taxiway'), [ways]);

    const runways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'runway'), [ways]);

    const [wayPathCache] = useState(() => new window.Map<number, Path2D>());

    const [wayTextPositionCache] = useState(() => new window.Map<number, [number, number]>());

    const NM_RADIUS = 0.9;
    params.current.compute({ lat: latitude, long: longitude }, NM_RADIUS, WIDTH, heading);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const ways = elements.filter((it) => it.type === 'way') as WayOverpassElement[];

        for (const way of ways) {
            const start = way.nodes[0] as Coordinates;
            const [sx, sy] = params.current.coordinatesToXYy(start);

            let pathString = `M ${sx} ${sy} `;
            let lx = sx;
            let ly = sy;
            for (let i = 1; i < way.nodes.length; i++) {
                const [nx, ny] = params.current.coordinatesToXYy(way.nodes[i] as Coordinates);
                pathString += `l ${nx - lx} ${ny - ly} `;
                lx = nx;
                ly = ny;
            }

            pathString = pathString.trimEnd();

            wayPathCache.set(way.id, new Path2D(pathString));
            wayTextPositionCache.set(way.id, [sx + ((lx - sx) / 2), sy + ((ly - sy) / 2)]);
        }
    }, [elements, wayPathCache, wayTextPositionCache]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        console.time('map draw');
        // Store the current transformation matrix
        ctx.save();

        // Use the identity matrix while clearing the canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // Restore the transform
        ctx.restore();

        ctx.resetTransform();
        ctx.translate(offsetX, offsetY);

        ctx.fillStyle = 'yellow';

        ctx.beginPath();

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 10;

        // Draw aprons

        ctx.fillStyle = '#555';

        for (const apron of aprons) {
            const wayPath = wayPathCache.get(apron.id);
            ctx.fill(wayPath);
        }

        // Draw taxiway pavements

        for (const taxiway of taxiways) {
            const wayPath = wayPathCache.get(taxiway.id);
            ctx.stroke(wayPath);
        }

        // Draw runway pavements

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 24;

        for (const runway of runways) {
            const wayPath = wayPathCache.get(runway.id);
            ctx.stroke(wayPath);
        }

        // Draw runway lines

        ctx.strokeStyle = '#fff';
        ctx.setLineDash([16, 17]);
        ctx.lineWidth = 1;

        for (const runway of runways) {
            const wayPath = wayPathCache.get(runway.id);
            ctx.stroke(wayPath);
        }

        ctx.setLineDash([]);

        // Draw taxiway lines

        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 0.75;

        for (const taxiway of taxiways) {
            const wayPath = wayPathCache.get(taxiway.id);
            ctx.stroke(wayPath);

            if (taxiway.tags.ref) {
                ctx.font = '20px sans-serif';
                ctx.fillStyle = 'yellow';
                ctx.textAlign = 'center';

                const [x, y] = wayTextPositionCache.get(taxiway.id);
                ctx.fillText(taxiway.tags.ref, x, y);
            }
        }

        console.timeEnd('map draw');
    }, [elements, offsetX, offsetY, heading, params.current.version, WIDTH, HEIGHT, aprons, wayPathCache, taxiways, runways, wayTextPositionCache]);

    const [isPanning, setPanning] = useState(false);

    const handleStartPan = () => setPanning(true);

    const handlePan = useCallback((e: React.MouseEvent) => {
        if (isPanning) {
            const { movementX, movementY } = e;

            if (movementX === 0 && movementY === 0) {
                return;
            }

            setOffsetX((old) => old + movementX);
            setOffsetY((old) => old + movementY);
        }
    }, [isPanning]);

    const handleStopPan = () => setPanning(false);

    return (
        <div>
            <canvas ref={canvasRef} height={HEIGHT} width={WIDTH} onMouseDown={handleStartPan} onMouseMove={handlePan} onMouseUp={handleStopPan} />
        </div>
    );
};
