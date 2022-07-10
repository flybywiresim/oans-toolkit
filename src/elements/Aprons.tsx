export class Aprons {
    public static draw(ctx, aprons, pathCache) {
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 10;
        ctx.fillStyle = '#555';

        for (const apron of aprons) {
            const wayPath = pathCache.get(apron.id);
            ctx.fill(wayPath);
        }
    }
}
