import { Units } from '../units';
import { Utils } from './util';

export class ParkingPositions {
    public static draw(ctx, params, centerPositionCache, radius, parkingPositions, pathCache) {
        // Draw parking position pavements

        ctx.strokeStyle = Utils.GATE_SHAPE_COLOR;
        ctx.lineWidth = Units.footToNauticalMile(200) * params.current.nmToPx;

        for (const parkingPosition of parkingPositions) {
            const wayPath = pathCache.get(parkingPosition.id);
            ctx.stroke(wayPath);
        }

        // Draw parking position lines

        ctx.strokeStyle = Utils.TAXIWAY_COLOR;

        if (radius < 1) {
            for (const parkingPosition of parkingPositions) {
                const wayPath = pathCache.get(parkingPosition.id);
                ctx.stroke(wayPath);

                if (parkingPosition.tags?.ref) {
                    const [x, y] = centerPositionCache.get(parkingPosition.id);
                    Utils.drawText(ctx, parkingPosition.tags.ref, x, y, 'cyan');
                }
            }
        }
    }
}
