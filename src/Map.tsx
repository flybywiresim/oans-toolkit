import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Aprons } from './elements/Aprons';
import { Buildings } from './elements/Buildings';
import { ParkingPositions } from './elements/ParkingPositions';
import { Runways } from './elements/Runways';
import { ServiceRoads } from './elements/ServiceRoads';
import { TaxiwayPavements } from './elements/TaxiwayPavements';
import { Taxiways } from './elements/Taxiways';
import { Terminals } from './elements/Terminals';
import { Towers } from './elements/Towers';
import { MapParameters } from './MapParameters';
import { RawRelationOverpassElement } from './RawOverpassTypes';
import { TransformedOverpassElement, TransformedWayOverpassElement } from './TransformedOverpassTypes';

interface MapProps {
    elements: TransformedOverpassElement[];
    latitude: number;
    longitude: number;
    heading: number;
}

export const Map = ({ elements, latitude, longitude, heading }: MapProps) => {
    const [frameTime, setFrameTime] = useState(0);

    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    const [radius, setRadius] = useState(1);

    const [paramsVersion, setParamsVersion] = useState(0);

    const WIDTH = window.innerWidth;
    const HEIGHT = 1000;

    const params = useRef(new MapParameters());

    const ways = useMemo(() => elements.filter((it) => it.type === 'way') as TransformedWayOverpassElement[], [elements]);
    const relations = useMemo(() => elements.filter((it) => it.type === 'relation') as RawRelationOverpassElement[], [elements]);
    const aprons = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'apron'), [ways]);

    const parkingPositions = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'parking_position'), [ways]);

    const terminals = useMemo(() => [
        ...ways.filter((it) => it.tags?.aeroway === 'terminal'),
        ...relations.filter((it) => it.tags?.aeroway === 'terminal'),
    ], [ways, relations]);

    const airsideFootways = useMemo(() => ways.filter((it) => it.tags?.airside === 'yes' && it.tags?.highway === 'footway' && it.tags?.tunnel !== 'yes'), [ways]);

    const taxiways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'taxiway'), [ways]);

    const runways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'runway'), [ways]);

    const roads = useMemo(() => ways.filter((it) => it.tags?.highway === 'service'), [ways]);

    const towers = useMemo(() => ways.filter(
        (it) => ['control_tower', 'control_center', 'tower'].some((towerName) => towerName === it.tags?.aeroway) || it.tags?.man_made === 'tower',
    ), [ways]);

    const towerRef = useRef((() => {
        const image = new Image(10, 10);
        image.src = '/TOWER_ICON.svg';

        return image;
    })());

    const planeRef = useRef((() => {
        const image = new Image(10, 10);
        image.src = '/AIRCRAFT_ICON.svg';

        return image;
    })());

    const buildings = useMemo(() => ways.filter((it) => it.tags && Object.prototype.hasOwnProperty.call(it.tags, 'building')
        && !['storage_tank', 'transportation'].includes(it.tags?.building) && it.tags?.aeroway !== 'terminal'), [ways]);

    const [pathCache] = useState(() => new window.Map<number, Path2D>());
    const [centerPositionCache] = useState(() => new window.Map<number, [number, number]>());

    useEffect(() => {
        params.current.compute({ lat: latitude, long: longitude }, radius, WIDTH, heading);
        setParamsVersion(params.current.version);
    }, [latitude, longitude, radius, WIDTH, heading]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // Cache paths for ways
        for (const way of ways) {
            const start = way.nodes[0].location;
            const [sx, sy] = params.current.coordinatesToXY(start);

            let minX = sx;
            let minY = sy;
            let maxX = sx;
            let maxY = sy;

            let pathString = `M ${sx} ${sy} `;
            let lx = sx;
            let ly = sy;
            for (let i = 1; i < way.nodes.length; i++) {
                const [nx, ny] = params.current.coordinatesToXY(way.nodes[i].location);

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

            pathCache.set(way.id, new Path2D(pathString));
            centerPositionCache.set(way.id, [cx, cy]);
        }

        // Cache paths for relations, by concatenating all paths of member ways
        for (const relation of relations) {
            const relationPath = new Path2D();

            for (const member of relation.members) {
                if (member.type === 'way' && (member.role === 'outer' || member.role === 'inner')) {
                    const wayPath = pathCache.get(member.ref);

                    relationPath.addPath(wayPath);
                }
            }

            pathCache.set(relation.id, relationPath);
        }
    }, [elements, ways, relations, pathCache, centerPositionCache, paramsVersion]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

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

        ctx.beginPath();

        ServiceRoads.draw(ctx, params, roads, pathCache);
        Aprons.draw(ctx, aprons, pathCache);
        ParkingPositions.draw(ctx, params, centerPositionCache, radius, parkingPositions, pathCache);
        Buildings.draw(ctx, buildings, pathCache);
        TaxiwayPavements.draw(ctx, params, taxiways, pathCache);
        Runways.draw(ctx, params, runways, pathCache);
        Towers.draw(ctx, params, towers, towerRef);
        Taxiways.draw(ctx, params, centerPositionCache, taxiways, pathCache);
        Terminals.draw(ctx, centerPositionCache, terminals, airsideFootways, pathCache);

        // Draw aircraft
        const [x, y] = params.current.coordinatesToXY({ lat: latitude, long: longitude });
        const IMAGE_SIZE = 32;
        const IMAGE_OFFSET = IMAGE_SIZE / 2;
        ctx.drawImage(planeRef.current, x - IMAGE_OFFSET, y - IMAGE_OFFSET, 32, 32);

        const timeTaken = performance.now() - startTime;

        setFrameTime(timeTaken);
    }, [elements, offsetX, offsetY, heading, params.current.version, WIDTH, HEIGHT, aprons, terminals, taxiways, runways, pathCache,
        centerPositionCache, buildings, towers, latitude, longitude, roads, radius, parkingPositions, airsideFootways]);

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
                    {pathCache.size}
                    {' '}
                    text=
                    {centerPositionCache.size}
                </pre>
            </span>
        </div>
    );
};
