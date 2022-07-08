import express = require('express');
import fetch from 'node-fetch';
import * as fs from 'fs';
import { PORT } from '../constants';
import { CacheService } from './cache.service';
import { CACHE_DIRECTORY } from './constants';

const app = express();

const decoder = new TextDecoder();
const encoder = new TextEncoder();

if (!fs.existsSync(CACHE_DIRECTORY)) {
    fs.mkdirSync(CACHE_DIRECTORY);
}

app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // @ts-ignore
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

app.get('/', async (req, res) => {
    const searchQuery = req.query.search as string;
    const forceFresh = req.query.forceFresh as string === 'true';
    const icao = req.query.icao as string;

    let cacheFileDataBuffer;
    try {
        cacheFileDataBuffer = await CacheService.readFile(icao);
    } catch (_) {
        // noop
    }

    if (cacheFileDataBuffer && !forceFresh) {
        res.send(decoder.decode(cacheFileDataBuffer));
    } else {
        fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: searchQuery,
            headers: { 'Content-Type': 'application/xml' },
        }).then((data) => data.json()).then((json) => {
            const dataBuffer = encoder.encode(JSON.stringify(json));

            CacheService.writeFile(icao, dataBuffer).then();

            res.send(json);
        });
    }
});

app.listen(PORT);
