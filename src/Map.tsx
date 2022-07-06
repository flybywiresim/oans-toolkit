import { Coordinates } from 'msfs-geo';
import React, { useEffect, useRef } from 'react';
import { MapParameters } from './MapParameters';
import { OverpassElement } from './Query';

interface MapProps {
    elements: OverpassElement[];
    latitude: number;
    longitude: number;
    heading: number;
}

export const Map = ({ elements, latitude, longitude, heading }: MapProps) => {
    const WIDTH = 1000;
    const HEIGHT = 1000;

    const params = useRef(new MapParameters());
    // const imageRef = useRef((() => {
    //     const image = new Image(10, 10);
    //     image.src = 'https://melmagazine.com/wp-content/uploads/2021/01/66f-1.jpg';

    //     return image;
    // })());

    const NM_RADIUS = 0.9;
    params.current.compute({ lat: latitude, long: longitude }, NM_RADIUS, WIDTH, heading);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const cx = WIDTH / 2;
        const cy = HEIGHT / 2;

        for (const element of elements) {
            if (element.type === 'node') {
                const [x, y] = params.current.coordinatesToXYy({ lat: element.lat, long: element.lon });
                ctx.fillStyle = 'yellow';
                ctx.beginPath();

                const NODE_RADIUS = NM_RADIUS * params.current.nmToPx / 600;
                ctx.ellipse(x + cx, y + cy, NODE_RADIUS, NODE_RADIUS, 0, 0, 2 * Math.PI);
                ctx.fill();
            } else if (element.type === 'way') {
                const [x, y] = params.current.coordinatesToXYy({ lat: (element.nodes[0] as Coordinates).lat, long: (element.nodes[0] as Coordinates).long });
                ctx.beginPath();
                ctx.moveTo(x + cx, y + cy);
                for (const node of element.nodes) {
                    const [x, y] = params.current.coordinatesToXYy({ lat: (node as Coordinates).lat, long: (node as Coordinates).long });
                    ctx.lineTo(x + cx, y + cy);
                }
                ctx.strokeStyle = 'yellow';
                ctx.stroke();
            }
        }
    }, [elements, latitude, longitude, heading, params.current.version, WIDTH, HEIGHT]);

    return (
        <div>
            <canvas ref={canvasRef} height={HEIGHT} width={WIDTH} />
        </div>
    );
};
