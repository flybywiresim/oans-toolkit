import React, { FC } from 'react';
import { createRoot } from 'react-dom/client';

const App: FC = () => <h1>Hello, World!</h1>;

createRoot(document.getElementById('root')).render(<App />);
