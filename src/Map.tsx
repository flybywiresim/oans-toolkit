import { Coordinates } from 'msfs-geo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapParameters } from './MapParameters';
import { RawRelationOverpassElement } from './RawOverpassTypes';
import { NodeData, TransformedOverpassElement, TransformedWayOverpassElement } from './TransformedOverpassTypes';
import { Metre, Units } from './units';

const RUNWAY_DEFAULT_WIDTH_METRES = 46;
const TAXIWAY_DEFAULT_WIDTH_METRES = 23;

const RUNWAY_STRIPE_LENGTH = Units.footToMetre(120);
const RUNWAY_STRIPE_GAP_LENGTH = Units.footToMetre(80);

const YELLOW_COLOR = '#ccbe3d';

interface MapProps {
    elements: TransformedOverpassElement[];
    latitude: number;
    longitude: number;
    heading: number;
}

const getSlope = (pointOne: [number, number], pointTwo: [number, number]) => {
    const [x1, y1] = pointOne;
    const [x2, y2] = pointTwo;

    return (y2 - y1) / (x2 - x1);
};

const getPerpendicularPoints = (point: [number, number], slope: number, distance: number): [Point, Point] => {
    const [x, y] = point;
    const perpendicularSlope = -1 / slope;
    const perpendicularYIntercept = y - perpendicularSlope * x;

    return circleLineSegmentIntersection(point, distance, point, [0, perpendicularYIntercept]) as [Point, Point];
};

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
type Pixel = number;

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

        const drawText = (text: string, x: number, y: number, fillStyle = YELLOW_COLOR) => {
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

        ctx.beginPath();

        // Draw service roads

        ctx.strokeStyle = YELLOW_COLOR;
        ctx.lineWidth = 10 * params.current.mToPx;

        for (const road of roads) {
            const wayPath = pathCache.get(road.id);
            ctx.stroke(wayPath);
        }

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 10;

        // Draw aprons

        ctx.fillStyle = '#555';

        for (const apron of aprons) {
            const wayPath = pathCache.get(apron.id);
            ctx.fill(wayPath);
        }

        // Draw parking positions

        ctx.strokeStyle = YELLOW_COLOR;
        ctx.lineWidth = 2.5;

        if (radius < 1) {
            for (const parkingPosition of parkingPositions) {
                const wayPath = pathCache.get(parkingPosition.id);
                ctx.stroke(wayPath);

                if (parkingPosition.tags?.ref) {
                    const [x, y] = centerPositionCache.get(parkingPosition.id);
                    drawText(parkingPosition.tags.ref, x, y, 'cyan');
                }
            }
        }

        // Draw buildings

        for (const building of buildings) {
            if (building.tags?.building === 'gate') {
                ctx.fillStyle = 'cyan';
            } else {
                ctx.fillStyle = '#1f6cba';
            }

            const wayPath = pathCache.get(building.id);
            ctx.fill(wayPath);
        }

        // Draw taxiway pavements

        ctx.strokeStyle = '#444';

        for (const taxiway of taxiways) {
            const widthMetres = taxiway.tags.width ? parseInt(taxiway.tags.width) : TAXIWAY_DEFAULT_WIDTH_METRES;
            const widthFeet = Units.metreToFoot(widthMetres);
            const widthNm = Units.footToNauticalMile(widthFeet);

            const widthPx = widthNm * params.current.nmToPx;

            const wayPath = pathCache.get(taxiway.id);

            ctx.lineWidth = widthPx;
            ctx.stroke(wayPath);
        }

        // Draw runway pavements

        ctx.strokeStyle = '#333';

        for (const runway of runways) {
            const widthMetres = runway.tags.width ? parseInt(runway.tags.width) : RUNWAY_DEFAULT_WIDTH_METRES;
            const widthFeet = Units.metreToFoot(widthMetres);
            const widthNm = Units.footToNauticalMile(widthFeet);

            const widthPx = widthNm * params.current.nmToPx;

            ctx.lineWidth = widthPx;
            ctx.beginPath();
            const { nodes } = runway;
            const [x1, y1] = params.current.coordinatesToXY(nodes[0].location);
            const [x2, y2] = params.current.coordinatesToXY(nodes[nodes.length - 1].location);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const [firstNode, lastNode] = [runway.nodes[0], runway.nodes[runway.nodes.length - 1]];
            const [firstNodePoint, lastNodePoint] = [params.current.coordinatesToXY(firstNode.location), params.current.coordinatesToXY(lastNode.location)];
            const slope = getSlope(firstNodePoint, lastNodePoint);

            const [firstNodePointOne, firstNodePointTwo] = getPerpendicularPoints(firstNodePoint, slope, widthPx / 2);
            const [lastNodePointOne, lastNodePointTwo] = getPerpendicularPoints(lastNodePoint, slope, widthPx / 2);
            if (!firstNodePointOne || !firstNodePointTwo || !lastNodePointOne || !lastNodePointTwo) continue;

            ctx.lineWidth = 1.25;
            ctx.strokeStyle = '#fff';
            if (Math.round(getSlope(firstNodePointOne, lastNodePointTwo) * 1000) === Math.round(slope * 1000)) {
                ctx.beginPath();
                ctx.moveTo(firstNodePointOne[0], firstNodePointOne[1]);
                ctx.lineTo(lastNodePointTwo[0], lastNodePointTwo[1]);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(firstNodePointTwo[0], firstNodePointTwo[1]);
                ctx.lineTo(lastNodePointOne[0], lastNodePointOne[1]);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(firstNodePointOne[0], firstNodePointOne[1]);
                ctx.lineTo(lastNodePointOne[0], lastNodePointOne[1]);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(firstNodePointTwo[0], firstNodePointTwo[1]);
                ctx.lineTo(lastNodePointTwo[0], lastNodePointTwo[1]);
                ctx.stroke();
            }

            ctx.strokeStyle = '#333';
        }

        // Draw runway lines

        ctx.strokeStyle = '#fff';
        const lineLength = RUNWAY_STRIPE_LENGTH * params.current.mToPx;
        const gapLength = RUNWAY_STRIPE_GAP_LENGTH * params.current.mToPx;
        ctx.setLineDash([lineLength, gapLength]);
        ctx.lineWidth = 1 * params.current.mToPx;

        for (const runway of runways) {
            if (runway.tags.runway === 'displaced_threshold' || runway.tags?.runway === 'blast_pad') continue;

            const wayPath = pathCache.get(runway.id);
            ctx.stroke(wayPath);
        }

        // Draw runway threshold stripes

        const getClosest = (value: number, array: number[]): number => {
            const index = array.findIndex((v) => v >= value);

            if (index === array.length - 1) {
                return array[index];
            }

            const nextValue = array[index + 1];
            const midValue = (value + nextValue) / 2;

            return value >= midValue ? nextValue : array[index];
        };

        const WIDTH_AND_STRIPES = {
            60: 4,
            75: 6,
            100: 8,
            150: 12,
            200: 16,
        };

        const widths = Object.keys(WIDTH_AND_STRIPES).map((k) => parseInt(k));
        const THRESHOLD_STRIPE_WIDTH: Metre = 1;
        const THRESHOLD_STRIPE_LENGTH: Metre = 46;
        const THRESHOLD_STRIPE_GAP: Metre = 1.5;

        const drawThreshold = (startNode: NodeData, runwayWidth: number, slope: number, flip: boolean): void => {
            const runwayWidthPx: Pixel = (params.current.mToPx * runwayWidth);
            const [startX, startY] = params.current.coordinatesToXY(startNode.location);
            const degreesSlope = Math.atan(slope) + (flip ? Math.PI : 0);
            const numberOfStripes = WIDTH_AND_STRIPES[getClosest(Units.metreToFoot(runwayWidth), widths)];
            const bottomOffset: Pixel = 3 * params.current.mToPx;
            const sideOffset: Pixel = 0.8 * params.current.mToPx;
            const usableRunwayDrawingSpace: Pixel = runwayWidthPx - (sideOffset * 2);

            const groupStripeCount = numberOfStripes / 2;
            const totalGroupGapSize = (groupStripeCount - 1) * (THRESHOLD_STRIPE_GAP * params.current.mToPx);
            const totalGroupStripeSize = groupStripeCount * (THRESHOLD_STRIPE_WIDTH * params.current.mToPx);
            const totalGroupSize = totalGroupGapSize + totalGroupStripeSize;
            const gapBetweenGroups = usableRunwayDrawingSpace - (totalGroupSize * 2);
            const xPoints = [0];

            for (let i = 0; i < groupStripeCount - 1; i++) {
                xPoints.push((i + 1) * ((THRESHOLD_STRIPE_WIDTH * params.current.mToPx) + (THRESHOLD_STRIPE_GAP * params.current.mToPx)));
            }
            xPoints.push(xPoints[xPoints.length - 1] + gapBetweenGroups);
            for (let i = 0; i < groupStripeCount - 1; i++) {
                xPoints.push(xPoints[numberOfStripes / 2] + (i + 1) * ((THRESHOLD_STRIPE_WIDTH * params.current.mToPx) + (THRESHOLD_STRIPE_GAP * params.current.mToPx)));
            }

            ctx.save();
            ctx.fillStyle = 'lightGrey';
            ctx.translate(startX, startY);
            ctx.rotate(degreesSlope);
            ctx.translate(-(runwayWidthPx / 2), bottomOffset);
            xPoints.forEach((xPoint) => {
                ctx.fillRect(
                    -THRESHOLD_STRIPE_LENGTH * params.current.mToPx,
                    xPoint - (runwayWidthPx / 2) - (sideOffset * 2),
                    THRESHOLD_STRIPE_LENGTH * params.current.mToPx,
                    THRESHOLD_STRIPE_WIDTH * params.current.mToPx,
                );
            });
            ctx.translate(0, -bottomOffset);
            ctx.fillRect(bottomOffset, -(runwayWidthPx / 2), THRESHOLD_STRIPE_WIDTH * params.current.mToPx, runwayWidthPx);

            ctx.translate((runwayWidthPx / 2), 0);

            ctx.rotate(-degreesSlope);
            ctx.translate(-startX, -startY);
            ctx.restore();
        };

        // Draw threshold stripes

        for (const runway of runways) {
            if (runway.tags?.runway === 'displaced_threshold' || runway.tags?.runway === 'blast_pad') continue;

            const firstNode = runway.nodes[0];
            const lastNode = runway.nodes[runway.nodes.length - 1];

            const [x1, y1] = params.current.coordinatesToXY(firstNode.location);
            const [x2, y2] = params.current.coordinatesToXY(lastNode.location);

            const slope = (y2 - y1) / (x2 - x1);

            const runwayWidth = parseInt(runway.tags?.width) ?? Units.footToMetre(150);

            const flip = firstNode[0] > lastNode[0];
            drawThreshold(lastNode, runwayWidth, slope, flip);
            drawThreshold(firstNode, runwayWidth, slope, !flip);
        }

        // Draw towers

        ctx.strokeStyle = '#0f0';

        for (const tower of towers) {
            const [x, y] = params.current.coordinatesToXY(getWayCenter(tower));
            const IMAGE_SIZE = 32;
            const IMAGE_OFFSET = IMAGE_SIZE / 2;
            ctx.drawImage(imageRef.current, x - IMAGE_OFFSET, y - IMAGE_OFFSET, IMAGE_SIZE, IMAGE_SIZE);
            drawText('TWR', x, y + IMAGE_SIZE + (IMAGE_SIZE / 8), '#0f0');
        }

        // Draw aircraft
        const [x, y] = params.current.coordinatesToXY({ lat: latitude, long: longitude });
        const IMAGE_SIZE = 32;
        const IMAGE_OFFSET = IMAGE_SIZE / 2;
        ctx.drawImage(planeRef.current, x - IMAGE_OFFSET, y - IMAGE_OFFSET, 32, 32);

        ctx.setLineDash([]);

        // Draw taxiway lines

        ctx.strokeStyle = YELLOW_COLOR;
        ctx.lineWidth = 0.75;

        for (const taxiway of taxiways) {
            const wayPath = pathCache.get(taxiway.id);
            ctx.stroke(wayPath);

            if (taxiway.tags.ref) {
                const [x, y] = centerPositionCache.get(taxiway.id);
                drawText(taxiway.tags.ref, x, y);
            }

            for (let i = 0; i < taxiway.nodes.length; i++) {
                const node = taxiway.nodes[i];

                if (node.tags?.aeroway !== 'holding_position') continue;
                const nextNode = taxiway.nodes[i + 1];
                const previousNode = taxiway.nodes[i - 1];

                const [x1, y1] = params.current.coordinatesToXY(node.location);
                const [x2, y2] = params.current.coordinatesToXY(nextNode?.location ?? previousNode?.location);
                const slope = (y2 - y1) / (x2 - x1);
                const perpendicularSlope = -1 / slope;
                const perpendicularYIntercept = y1 - perpendicularSlope * x1;

                const widthMetres = taxiway.tags.width ? parseInt(taxiway.tags.width) : TAXIWAY_DEFAULT_WIDTH_METRES;
                const widthFeet = Units.metreToFoot(widthMetres);
                const widthNm = Units.footToNauticalMile(widthFeet);

                const widthPx = widthNm * params.current.nmToPx;

                const [pointOne, pointTwo] = circleLineSegmentIntersection(
                    [x1, y1],
                    widthPx / 2,
                    [x1, y1],
                    [0, perpendicularYIntercept],
                );

                ctx.strokeStyle = '#f00';
                ctx.beginPath();
                ctx.moveTo(pointOne[0], pointOne[1]);
                ctx.lineTo(pointTwo[0], pointTwo[1]);
                ctx.stroke();
                ctx.strokeStyle = YELLOW_COLOR;
            }
        }

        // Draw terminals

        for (const terminal of terminals) {
            ctx.fillStyle = 'cyan';

            const terminalPath = pathCache.get(terminal.id);
            ctx.fill(terminalPath, 'evenodd');

            // TODO labels for relation-based terminals
            if (terminal.type === 'way' && terminal.tags.name && !['warehouse', 'commercial'].includes(terminal.tags.building)) {
                let string = terminal.tags.name;

                string = string.replace('Taxiway', '');
                string = string.trim().toUpperCase();

                const labelWidth = string.length * 13;
                const labelHeight = 20;

                const [x, y] = centerPositionCache.get(terminal.id) ?? [undefined, undefined];

                if (x === undefined || y === undefined) continue;

                ctx.fillStyle = '#000';
                ctx.fillRect(x - labelWidth / 2, y - labelHeight / 2 - 8, labelWidth, labelHeight);

                ctx.font = '21px Ecam';
                ctx.fillStyle = 'cyan';
                ctx.textAlign = 'center';

                ctx.fillText(string, x, y);
            }
        }

        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 5;

        for (const airsideFootway of airsideFootways) {
            const terminalPath = pathCache.get(airsideFootway.id);
            ctx.stroke(terminalPath);
        }

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
