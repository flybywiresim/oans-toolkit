import { Coordinates } from 'msfs-geo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapParameters } from './MapParameters';
import { OverpassElement, WayOverpassElement } from './Query';
import towerIcon from '../public/TOWER_ICON.svg';

interface MapProps {
    elements: OverpassElement[];
    latitude: number;
    longitude: number;
    heading: number;
}

const getWayCenter = (way: WayOverpassElement): Coordinates => {
    const lowestLatitude = Math.min(...(way.nodes as Coordinates[]).map((node) => node.lat));
    const highestLatitude = Math.max(...(way.nodes as Coordinates[]).map((node) => node.lat));
    const lowestLongitude = Math.min(...(way.nodes as Coordinates[]).map((node) => node.long));
    const highestLongitude = Math.max(...(way.nodes as Coordinates[]).map((node) => node.long));

    return {
        lat: (lowestLatitude + highestLatitude) / 2,
        long: (lowestLongitude + highestLongitude) / 2,
    };
};

export const Map = ({ elements, latitude, longitude, heading }: MapProps) => {
    const [frameTime, setFrameTime] = useState(0);

    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    const [radius, setRadius] = useState(1);

    const [paramsVersion, setParamsVersion] = useState(0);

    const WIDTH = 1000;
    const HEIGHT = 1000;

    const params = useRef(new MapParameters());

    const ways = useMemo(() => elements.filter((it) => it.type === 'way') as WayOverpassElement[], [elements]);

    const aprons = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'apron'), [ways]);

    const terminals = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'terminal'), [ways]);

    const taxiways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'taxiway'), [ways]);

    const runways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'runway'), [ways]);

    const towers = useMemo(() => ways.filter(
        (it) => ['control_tower', 'control_center', 'tower'].some((towerName) => towerName === it.tags?.aeroway) || it.tags?.man_made === 'tower',
    ), [ways]);

    const imageRef = useRef((() => {
        const image = new Image(10, 10);
        image.src = '../public/TOWER_ICON.svg';

        return image;
    })());

    const buildings = useMemo(() => ways.filter((it) => it.tags && Object.prototype.hasOwnProperty.call(it.tags, 'building')
        && it.tags?.building !== 'storage_tank' && it.tags?.aeroway !== 'terminal'), [ways]);

    const [wayPathCache] = useState(() => new window.Map<number, Path2D>());
    const [wayTextPositionCache] = useState(() => new window.Map<number, [number, number]>());

    useEffect(() => {
        params.current.compute({ lat: latitude, long: longitude }, radius, WIDTH, heading);
        setParamsVersion(params.current.version);
    }, [latitude, longitude, radius, WIDTH, heading]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const ways = elements.filter((it) => it.type === 'way') as WayOverpassElement[];

        for (const way of ways) {
            const start = way.nodes[0] as Coordinates;
            const [sx, sy] = params.current.coordinatesToXYy(start);

            let minX = sx;
            let minY = sy;
            let maxX = sx;
            let maxY = sy;

            let pathString = `M ${sx} ${sy} `;
            let lx = sx;
            let ly = sy;
            for (let i = 1; i < way.nodes.length; i++) {
                const [nx, ny] = params.current.coordinatesToXYy(way.nodes[i] as Coordinates);

                if (nx < minX) {
                    minX = nx;
                }
                if (nx > maxX) {
                    maxX = nx;
                }
                if (ny < minY) {
                    minY = ny;
                }
                if (ny > maxY) {
                    maxY = ny;
                }

                pathString += `l ${nx - lx} ${ny - ly} `;
                lx = nx;
                ly = ny;
            }

            const cx = minX + ((maxX - minX) / 2);
            const cy = minY + ((maxY - minY) / 2);

            pathString = pathString.trimEnd();

            wayPathCache.set(way.id, new Path2D(pathString));
            wayTextPositionCache.set(way.id, [cx, cy]);
        }
    }, [elements, wayPathCache, wayTextPositionCache, paramsVersion]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const drawText = (text: string, x: number, y: number, fillStyle = 'yellow') => {
            let string = text;

            string = string.replace('Taxiway', '');
            string = string.trim().toUpperCase();

            const labelWidth = string.length * 13;
            const labelHeight = 20;

            ctx.fillStyle = '#000';
            ctx.fillRect(x - labelWidth / 2, y - labelHeight / 2 - 8, labelWidth, labelHeight);

            ctx.font = '21px Ecam';
            ctx.fillStyle = fillStyle;
            ctx.textAlign = 'center';

            ctx.fillText(string, x, y);
        };

        const startTime = performance.now();

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

        // Draw terminals

        for (const terminal of terminals) {
            ctx.fillStyle = 'cyan';

            const wayPath = wayPathCache.get(terminal.id);
            ctx.fill(wayPath);

            if (terminal.tags.name) {
                let string = terminal.tags.name;

                string = string.replace('Taxiway', '');
                string = string.trim().toUpperCase();

                const labelWidth = string.length * 13;
                const labelHeight = 20;

                const [x, y] = wayTextPositionCache.get(terminal.id);

                ctx.fillStyle = '#000';
                ctx.fillRect(x - labelWidth / 2, y - labelHeight / 2 - 8, labelWidth, labelHeight);

                ctx.font = '21px Ecam';
                ctx.fillStyle = 'cyan';
                ctx.textAlign = 'center';

                ctx.fillText(string, x, y);
            }
        }

        // Draw buildings

        ctx.fillStyle = '#1f6cba';
        for (const building of buildings) {
            const wayPath = wayPathCache.get(building.id);
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

        // Draw towers

        ctx.strokeStyle = '#0f0';

        for (const tower of towers) {
            const [x, y] = params.current.coordinatesToXYy(getWayCenter(tower));
            const IMAGE_SIZE = 32;
            const IMAGE_OFFSET = IMAGE_SIZE / 2;
            ctx.drawImage(imageRef.current, x - IMAGE_OFFSET, y - IMAGE_OFFSET, IMAGE_SIZE, IMAGE_SIZE);
            drawText('TWR', x, y + IMAGE_SIZE + (IMAGE_SIZE / 8), '#0f0');
        }

        ctx.setLineDash([]);

        // Draw taxiway lines

        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 0.75;

        for (const taxiway of taxiways) {
            const wayPath = wayPathCache.get(taxiway.id);
            ctx.stroke(wayPath);

            if (taxiway.tags.ref) {
                const [x, y] = wayTextPositionCache.get(taxiway.id);
                drawText(taxiway.tags.ref, x, y);
            }
        }

        const timeTaken = performance.now() - startTime;

        setFrameTime(timeTaken);
    }, [elements, offsetX, offsetY, heading, params.current.version, WIDTH, HEIGHT, aprons, terminals, taxiways, runways, wayPathCache, wayTextPositionCache]);

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

    const handleZoomIn = () => setRadius((old) => Math.max(0.1, old / 2));
    const handleZoomOut = () => setRadius((old) => old * 2);

    return (
        <div>
            <canvas ref={canvasRef} height={HEIGHT} width={WIDTH} onMouseDown={handleStartPan} onMouseMove={handlePan} onMouseUp={handleStopPan} />

            <span className="flex bg-gray-300 gap-x-5">
                <span className="flex">
                    <button type="button" className="bg-gray-400" onClick={handleZoomIn}>+</button>
                    <button type="button" className="bg-gray-400" onClick={handleZoomOut}>-</button>
                </span>
            </span>

            <span className="flex bg-gray-200 gap-x-10">
                <pre>
                    [detailed element breakdown]
                    <br />
                    twy=
                    {taxiways.length}
                    {' '}
                    rwy=
                    {runways.length}
                    {' '}
                    apr=
                    {aprons.length}
                    {' '}
                    term=
                    {terminals.length}
                    <pre className="text-green-600">
                        ways=
                        {ways.length}
                    </pre>

                    <pre className="text-orange-600">
                        nonways=
                        {elements.length - ways.length}
                    </pre>
                </pre>

                <pre>
                    [render debug]
                    <br />
                    last frameTime=
                    {`${frameTime}ms`}
                </pre>

                <pre>
                    [draw cache size]
                    <br />
                    path=
                    {wayPathCache.size}
                    {' '}
                    text=
                    {wayTextPositionCache.size}
                </pre>
            </span>
        </div>
    );
};
