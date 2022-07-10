import { Units } from '../units';
import { Utils } from './util';

export class Taxiways {
    public static draw(ctx, params, centerPositionCache, taxiways, pathCache) {
        ctx.setLineDash([]);

        ctx.strokeStyle = Utils.TAXIWAY_COLOR;
        ctx.lineWidth = 0.75;

        for (const taxiway of taxiways) {
            const wayPath = pathCache.get(taxiway.id);
            ctx.stroke(wayPath);

            if (taxiway.tags.ref) {
                const [x, y] = centerPositionCache.get(taxiway.id);
                Utils.drawText(ctx, taxiway.tags.ref, x, y);
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

                const widthMetres = taxiway.tags.width ? parseInt(taxiway.tags.width) : Utils.TAXIWAY_DEFAULT_WIDTH_METRES;
                const widthFeet = Units.metreToFoot(widthMetres);
                const widthNm = Units.footToNauticalMile(widthFeet);

                const widthPx = widthNm * params.current.nmToPx;

                const [pointOne, pointTwo] = Utils.circleLineSegmentIntersection(
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
                ctx.strokeStyle = Utils.TAXIWAY_COLOR;
            }
        }
    }
}
