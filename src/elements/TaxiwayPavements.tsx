import { Units } from '../units';
import { Utils } from './util';

export class TaxiwayPavements {
    public static draw(ctx, params, taxiways, pathCache) {
        ctx.strokeStyle = '#444';

        for (const taxiway of taxiways) {
            const widthMetres = taxiway.tags.width ? parseInt(taxiway.tags.width) : Utils.TAXIWAY_DEFAULT_WIDTH_METRES;
            const widthFeet = Units.metreToFoot(widthMetres);
            const widthNm = Units.footToNauticalMile(widthFeet);

            const widthPx = widthNm * params.current.nmToPx;

            const wayPath = pathCache.get(taxiway.id);

            ctx.lineWidth = widthPx;
            ctx.stroke(wayPath);
        }
    }
}
