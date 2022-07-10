export class Buildings {
    public static draw(ctx, buildings, pathCache) {
        for (const building of buildings) {
            if (building.tags?.building === 'gate') {
                ctx.fillStyle = 'cyan';
            } else {
                ctx.fillStyle = '#1f6cba';
            }

            const wayPath = pathCache.get(building.id);
            ctx.fill(wayPath);
        }
    }
}
