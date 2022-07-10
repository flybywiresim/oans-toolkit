export class Terminals {
    public static draw(ctx, centerPositionCache, terminals, airsideFootways, pathCache) {
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
    }
}
