import { Coordinates } from 'msfs-geo';
import { TransformedWayOverpassElement } from '../TransformedOverpassTypes';

export type Pixel = number;
export type Point = [number, number];

export class Utils {
    public static readonly TAXIWAY_COLOR = '#e6d545';

    public static readonly SERVICE_ROAD_COLOR = '#bfb239';

    public static readonly GATE_SHAPE_COLOR = '#666';

    public static readonly TAXIWAY_DEFAULT_WIDTH_METRES = 30;

    public static drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fillStyle = Utils.TAXIWAY_COLOR) {
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
    }

    public static getSlope(pointOne: Point, pointTwo: Point): number {
        const [x1, y1] = pointOne;
        const [x2, y2] = pointTwo;

        return (y2 - y1) / (x2 - x1);
    }

    public static getPerpendicularPoints(point: Point, slope: number, distance: number): [Point, Point] {
        const [x, y] = point;
        const perpendicularSlope = -1 / slope;
        const perpendicularYIntercept = y - perpendicularSlope * x;

        return Utils.circleLineSegmentIntersection(point, distance, point, [0, perpendicularYIntercept]) as [Point, Point];
    }

    public static getWayCenter(way: TransformedWayOverpassElement): Coordinates {
        const lowestLatitude = Math.min(...way.nodes.map((node) => node.location.lat));
        const highestLatitude = Math.max(...way.nodes.map((node) => node.location.lat));
        const lowestLongitude = Math.min(...way.nodes.map((node) => node.location.long));
        const highestLongitude = Math.max(...way.nodes.map((node) => node.location.long));

        return {
            lat: (lowestLatitude + highestLatitude) / 2,
            long: (lowestLongitude + highestLongitude) / 2,
        };
    }

    public static zip(...arrays: any[]): any[] {
        const length = Math.min(...arrays.map((arr) => arr.length));
        return Array.from({ length }, (value, index) => arrays.map(((array) => array[index])));
    }

    public static circleLineSegmentIntersection(circleCenter: Point, circleRadius: number, pt1: Point, pt2: Point, fullLine = true, tangentTol = 1e-9): number[][] {
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
            Utils.zip(intersections, fractionAlongSegment).forEach(([pt, frac]) => {
                if (frac >= 0 && frac <= 1) {
                    intersections.push(pt);
                }
            });
        }
        if (intersections.length === 2 && Math.abs(discriminant) <= tangentTol) { // If line is tangent to circle, return just one point (as both intersections have same location)
            return [intersections[0]];
        }

        return intersections;
    }
}
