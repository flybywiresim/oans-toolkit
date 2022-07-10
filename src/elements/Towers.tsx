import { Utils } from './util';

export class Towers {
    public static draw(ctx, params, towers, towerRef) {
        ctx.strokeStyle = '#0f0';

        for (const tower of towers) {
            const [x, y] = params.current.coordinatesToXY(Utils.getWayCenter(tower));
            const IMAGE_SIZE = 32;
            const IMAGE_OFFSET = IMAGE_SIZE / 2;
            ctx.drawImage(towerRef.current, x - IMAGE_OFFSET, y - IMAGE_OFFSET, IMAGE_SIZE, IMAGE_SIZE);
            Utils.drawText(ctx, 'TWR', x, y + IMAGE_SIZE + (IMAGE_SIZE / 8), '#0f0');
        }
    }
}
