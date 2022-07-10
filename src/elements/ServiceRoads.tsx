import { Utils } from './util';

export class ServiceRoads {
    public static draw(ctx, params, roads, pathCache) {
        ctx.strokeStyle = Utils.SERVICE_ROAD_COLOR;
        ctx.lineWidth = 10 * params.current.mToPx;

        for (const road of roads) {
            const wayPath = pathCache.get(road.id);
            ctx.stroke(wayPath);
        }
    }
}
