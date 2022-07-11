import { NodeData } from '../TransformedOverpassTypes';
import { Metre, Units } from '../units';
import { Pixel, Utils } from './util';

export class Runways {
    public static readonly WIDTH_AND_STRIPES = {
        60: 4,
        75: 6,
        100: 8,
        150: 12,
        200: 16,
    };

    public static readonly WIDTHS = Object.keys(Runways.WIDTH_AND_STRIPES).map((k) => parseInt(k));

    public static readonly THRESHOLD_STRIPE_WIDTH: Metre = 1;

    public static readonly THRESHOLD_STRIPE_LENGTH: Metre = 46;

    public static readonly THRESHOLD_STRIPE_GAP: Metre = 1.5;

    public static readonly RUNWAY_STRIPE_LENGTH = Units.footToMetre(120);

    public static readonly RUNWAY_STRIPE_GAP_LENGTH = Units.footToMetre(80);

    public static readonly RUNWAY_DEFAULT_WIDTH_METRES = 46;

    public static draw(ctx, params, runways, pathCache) {
        // Draw runway pavements

        ctx.strokeStyle = '#333';

        for (const runway of runways) {
            const widthMetres = runway.tags.width ? parseInt(runway.tags.width) : Runways.RUNWAY_DEFAULT_WIDTH_METRES;
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
            const slope = Utils.getSlope(firstNodePoint, lastNodePoint);

            const [firstNodePointOne, firstNodePointTwo] = Utils.getPerpendicularPoints(firstNodePoint, slope, widthPx / 2);
            const [lastNodePointOne, lastNodePointTwo] = Utils.getPerpendicularPoints(lastNodePoint, slope, widthPx / 2);
            if (!firstNodePointOne || !firstNodePointTwo || !lastNodePointOne || !lastNodePointTwo) continue;

            ctx.lineWidth = 1.25;
            ctx.strokeStyle = '#fff';
            if (Math.round(Utils.getSlope(firstNodePointOne, lastNodePointTwo) * 1000) === Math.round(slope * 1000)) {
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
        const lineLength = Runways.RUNWAY_STRIPE_LENGTH * params.current.mToPx;
        const gapLength = Runways.RUNWAY_STRIPE_GAP_LENGTH * params.current.mToPx;
        ctx.setLineDash([lineLength, gapLength]);
        ctx.lineWidth = 1 * params.current.mToPx;

        for (const runway of runways) {
            if (runway.tags.runway === 'displaced_threshold' || runway.tags?.runway === 'blast_pad') continue;

            const wayPath = pathCache.get(runway.id);
            ctx.stroke(wayPath);
        }

        // Draw threshold stripes

        for (const runway of runways) {
            if (runway.tags?.runway === 'displaced_threshold' || runway.tags?.runway === 'blast_pad') continue;

            const firstNode = runway.nodes[0];
            const lastNode = runway.nodes[runway.nodes.length - 1];

            const firstXY = params.current.coordinatesToXY(firstNode.location);
            const lastXY = params.current.coordinatesToXY(lastNode.location);

            const slope = Utils.getSlope(firstXY, lastXY);

            const runwayWidth = parseInt(runway.tags?.width) ?? Units.footToMetre(150);
            const flip = Math.round(slope) >= 0 ? lastXY[0] < firstXY[0] : lastXY[0] > firstXY[0];
            console.log(firstXY, lastXY, slope, runway.tags?.ref, flip);

            Runways.drawThreshold(ctx, params, lastNode, runwayWidth, slope, flip);
            Runways.drawThreshold(ctx, params, firstNode, runwayWidth, slope, !flip);
        }
    }

    public static getClosest(value: number, array: number[]): number {
        const index = array.findIndex((v) => v >= value);

        if (index === array.length - 1) {
            return array[index];
        }

        const nextValue = array[index + 1];
        const midValue = (value + nextValue) / 2;

        return value >= midValue ? nextValue : array[index];
    }

    private static drawThreshold(ctx: CanvasRenderingContext2D, params, startNode: NodeData, runwayWidth: number, slope: number, flip: boolean): void {
        const runwayWidthPx: Pixel = (params.current.mToPx * runwayWidth);
        const [startX, startY] = params.current.coordinatesToXY(startNode.location);
        const degreesSlope = Math.atan(slope) + (flip ? Math.PI : 0);
        const numberOfStripes = Runways.WIDTH_AND_STRIPES[Runways.getClosest(Units.metreToFoot(runwayWidth), Runways.WIDTHS)];
        const bottomOffset: Pixel = 3 * params.current.mToPx;
        const sideOffset: Pixel = 0.8 * params.current.mToPx;
        const usableRunwayDrawingSpace: Pixel = runwayWidthPx - (sideOffset * 2);

        const groupStripeCount = numberOfStripes / 2;
        const totalGroupGapSize = (groupStripeCount - 1) * (Runways.THRESHOLD_STRIPE_GAP * params.current.mToPx);
        const totalGroupStripeSize = groupStripeCount * (Runways.THRESHOLD_STRIPE_WIDTH * params.current.mToPx);
        const totalGroupSize = totalGroupGapSize + totalGroupStripeSize;
        const gapBetweenGroups = usableRunwayDrawingSpace - (totalGroupSize * 2);
        const xPoints = [0];

        for (let i = 0; i < groupStripeCount - 1; i++) {
            xPoints.push((i + 1) * ((Runways.THRESHOLD_STRIPE_WIDTH * params.current.mToPx) + (Runways.THRESHOLD_STRIPE_GAP * params.current.mToPx)));
        }
        xPoints.push(xPoints[xPoints.length - 1] + gapBetweenGroups);
        for (let i = 0; i < groupStripeCount - 1; i++) {
            xPoints.push(xPoints[numberOfStripes / 2] + (i + 1) * ((Runways.THRESHOLD_STRIPE_WIDTH * params.current.mToPx) + (Runways.THRESHOLD_STRIPE_GAP * params.current.mToPx)));
        }

        ctx.save();
        ctx.fillStyle = 'lightGrey';
        ctx.translate(startX, startY);
        ctx.rotate(degreesSlope);
        ctx.translate(-(runwayWidthPx / 2), bottomOffset);
        xPoints.forEach((xPoint) => {
            ctx.fillRect(
                -Runways.THRESHOLD_STRIPE_LENGTH * params.current.mToPx,
                xPoint - (runwayWidthPx / 2) - (sideOffset * 2),
                Runways.THRESHOLD_STRIPE_LENGTH * params.current.mToPx,
                Runways.THRESHOLD_STRIPE_WIDTH * params.current.mToPx,
            );
        });
        ctx.translate(0, -bottomOffset);
        ctx.fillRect(bottomOffset, -(runwayWidthPx / 2), Runways.THRESHOLD_STRIPE_WIDTH * params.current.mToPx, runwayWidthPx);

        ctx.translate((runwayWidthPx / 2), 0);

        ctx.rotate(-degreesSlope);
        ctx.translate(-startX, -startY);
        ctx.restore();
    }
}
