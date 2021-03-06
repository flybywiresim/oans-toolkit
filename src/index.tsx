import React, { FC } from 'react';
import { createRoot } from 'react-dom/client';
import { Query } from './Query';

const App: FC = () => (
    <div className="p-2">
        <Query />
    </div>
);

createRoot(document.getElementById('root')).render(<App />);
