import { Coordinates } from 'msfs-geo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapParameters } from './MapParameters';
import { RawRelationOverpassElement } from './RawOverpassTypes';
import { TransformedOverpassElement, TransformedWayOverpassElement } from './TransformedOverpassTypes';

interface MapProps {
    elements: TransformedOverpassElement[];
    latitude: number;
    longitude: number;
    heading: number;
}

const getWayCenter = (way: TransformedWayOverpassElement): Coordinates => {
    const lowestLatitude = Math.min(...way.nodes.map((node) => node.location.lat));
    const highestLatitude = Math.max(...way.nodes.map((node) => node.location.lat));
    const lowestLongitude = Math.min(...way.nodes.map((node) => node.location.long));
    const highestLongitude = Math.max(...way.nodes.map((node) => node.location.long));

    return {
        lat: (lowestLatitude + highestLatitude) / 2,
        long: (lowestLongitude + highestLongitude) / 2,
    };
};

type Point = [number, number];

const zip = (...arrays: any[]) => {
    const length = Math.min(...arrays.map((arr) => arr.length));
    return Array.from({ length }, (value, index) => arrays.map(((array) => array[index])));
};

const circleLineSegmentIntersection = (circleCenter: Point, circleRadius: number, pt1: Point, pt2: Point, fullLine = true, tangentTol = 1e-9) => {
    /** Find the points at which a circle intersects a line-segment.  This can happen at 0, 1, or 2 points.

    :param circle_center: The (x, y) location of the circle center
    :param circle_radius: The radius of the circle
    :param pt1: The (x, y) location of the first point of the segment
    :param pt2: The (x, y) location of the second point of the segment
    :param full_line: True to find intersections along full line - not just in the segment.  False will just return intersections within the segment.
    :param tangent_tol: Numerical tolerance at which we decide the intersections are close enough to consider it a tangent
    :return Sequence[Tuple[float, float]]: A list of length 0, 1, or 2, where each element is a point at which the circle intercepts a line segment.

    Note: We follow: http://mathworld.wolfram.com/Circle-LineIntersection.html
    */

    const [[p1x, p1y], [p2x, p2y], [cx, cy]] = [pt1, pt2, circleCenter];
    const [[x1, y1], [x2, y2]] = [[p1x - cx, p1y - cy], [p2x - cx, p2y - cy]];
    const [dx, dy] = [x2 - x1, y2 - y1];
    const dr = (dx ** 2 + dy ** 2) ** 0.5;
    const bigD = x1 * y2 - x2 * y1;
    const discriminant = circleRadius ** 2 * dr ** 2 - bigD ** 2;

    if (discriminant < 0) return []; // No intersection between circle and line

    // There may be 0, 1, or 2 intersections with the segment
    // eslint-disable-next-line max-len
    const intersections = (dy < 0 ? [1, -1] : [-1, 1]).map((sign) => [cx + (bigD * dy + sign * (dy < 0 ? -1 : 1) * dx * discriminant ** 0.5) / dr ** 2, cy + (-bigD * dx + sign * Math.abs(dy) * discriminant ** 0.5) / dr ** 2]); // This makes sure the order along the segment is correct
    if (!fullLine) { // If only considering the segment, filter out intersections that do not fall within the segment
        const fractionAlongSegment = intersections.map(([xi, yi]) => (Math.abs(dx) > Math.abs(dy) ? (xi - p1x) / dx : (yi - p1y) / dy));
        intersections.splice(0);
        zip(intersections, fractionAlongSegment).forEach(([pt, frac]) => {
            if (frac >= 0 && frac <= 1) {
                intersections.push(pt);
            }
        });
    }
    if (intersections.length === 2 && Math.abs(discriminant) <= tangentTol) { // If line is tangent to circle, return just one point (as both intersections have same location)
        return [intersections[0]];
    }

    return intersections;
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

    const ways = useMemo(() => elements.filter((it) => it.type === 'way') as TransformedWayOverpassElement[], [elements]);
    const relations = useMemo(() => elements.filter((it) => it.type === 'relation') as RawRelationOverpassElement[], [elements]);

    const aprons = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'apron'), [ways]);

    const terminals = useMemo(() => [
        ...ways.filter((it) => it.tags?.aeroway === 'terminal'),
        ...relations.filter((it) => it.tags?.aeroway === 'terminal'),
    ], [ways, relations]);

    const taxiways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'taxiway'), [ways]);

    const runways = useMemo(() => ways.filter((it) => it.tags?.aeroway === 'runway'), [ways]);

    const roads = useMemo(() => ways.filter((it) => it.tags?.airside === 'yes' && it.tags?.highway === 'service'), [ways]);

    const towers = useMemo(() => ways.filter(
        (it) => ['control_tower', 'control_center', 'tower'].some((towerName) => towerName === it.tags?.aeroway) || it.tags?.man_made === 'tower',
    ), [ways]);

    const imageRef = useRef((() => {
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
        && !['storage_tank', 'yes', 'transportation'].includes(it.tags?.building) && it.tags?.aeroway !== 'terminal'), [ways]);

    const [wayPathCache] = useState(() => new window.Map<number, Path2D>());
    const [wayTextPositionCache] = useState(() => new window.Map<number, [number, number]>());

    useEffect(() => {
        params.current.compute({ lat: latitude, long: longitude }, radius, WIDTH, heading);
        setParamsVersion(params.current.version);
    }, [latitude, longitude, radius, WIDTH, heading]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const metersToFeet = (meters: number) => meters * 3.2084;

    useEffect(() => {
        const ways: TransformedWayOverpassElement[] = elements.filter((it) => it.type === 'way');

        for (const way of ways) {
            const start = way.nodes[0].location;
            const [sx, sy] = params.current.coordinatesToXYy(start);

            let minX = sx;
            let minY = sy;
            let maxX = sx;
            let maxY = sy;

            let pathString = `M ${sx} ${sy} `;
            let lx = sx;
            let ly = sy;
            for (let i = 1; i < way.nodes.length; i++) {
                const [nx, ny] = params.current.coordinatesToXYy(way.nodes[i].location);

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

        // Draw service roads

        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 5;

        for (const road of roads) {
            const wayPath = wayPathCache.get(road.id);
            ctx.stroke(wayPath);
        }

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 10;

        // Draw aprons

        ctx.fillStyle = '#555';

        for (const apron of aprons) {
            const wayPath = wayPathCache.get(apron.id);
            ctx.fill(wayPath);
        }

        // Draw buildings

        ctx.fillStyle = '#1f6cba';
        for (const building of buildings) {
            const wayPath = wayPathCache.get(building.id);
            ctx.fill(wayPath);
        }

        // Draw terminals

        for (const terminal of terminals) {
            ctx.fillStyle = 'cyan';

            if (terminal.type === 'way') {
                const wayPath = wayPathCache.get(terminal.id);
                ctx.fill(wayPath);
            } else {
                for (const member of terminal.members) {
                    if (member.type === 'way' && member.role === 'outer') {
                        const wayPath = wayPathCache.get(member.ref);
                        ctx.fill(wayPath);
                    }
                }
            }

            if (terminal.tags.name && !['warehouse', 'commercial'].includes(terminal.tags.building)) {
                let string = terminal.tags.name;

                string = string.replace('Taxiway', '');
                string = string.trim().toUpperCase();

                const labelWidth = string.length * 13;
                const labelHeight = 20;

                const [x, y] = wayTextPositionCache.get(terminal.id) ?? [undefined, undefined];

                if (x === undefined || y === undefined) continue;

                ctx.fillStyle = '#000';
                ctx.fillRect(x - labelWidth / 2, y - labelHeight / 2 - 8, labelWidth, labelHeight);

                ctx.font = '21px Ecam';
                ctx.fillStyle = 'cyan';
                ctx.textAlign = 'center';

                ctx.fillText(string, x, y);
            }
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

        const [x, y] = params.current.coordinatesToXYy({ lat: latitude, long: longitude });
        ctx.drawImage(planeRef.current, x, y, 32, 32);

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

            for (let i = 0; i < taxiway.nodes.length; i++) {
                const node = taxiway.nodes[i];

                if (node.tags?.aeroway !== 'holding_position') continue;
                const nextNode = taxiway.nodes[i + 1];
                const previousNode = taxiway.nodes[i - 1];

                const [x1, y1] = params.current.coordinatesToXYy(node.location);
                const [x2, y2] = params.current.coordinatesToXYy(nextNode?.location ?? previousNode?.location);
                const slope = (y2 - y1) / (x2 - x1);
                const perpendicularSlope = -1 / slope;
                const perpendicularYIntercept = y1 - perpendicularSlope * x1;
                const DISTANCE_FROM_CENTER = 5;

                const [pointOne, pointTwo] = circleLineSegmentIntersection(
                    [x1, y1],
                    DISTANCE_FROM_CENTER,
                    [x1, y1],
                    [0, perpendicularYIntercept],
                );

                ctx.strokeStyle = '#f00';
                ctx.beginPath();
                ctx.moveTo(pointOne[0], pointOne[1]);
                ctx.lineTo(pointTwo[0], pointTwo[1]);
                ctx.stroke();
                ctx.strokeStyle = 'yellow';
            }
        }

        const timeTaken = performance.now() - startTime;

        setFrameTime(timeTaken);
    }, [elements, offsetX, offsetY, heading, params.current.version, WIDTH, HEIGHT, aprons, terminals, taxiways, runways, wayPathCache, wayTextPositionCache, buildings, towers]);

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
