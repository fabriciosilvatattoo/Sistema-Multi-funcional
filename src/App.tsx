/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Chat from '@/pages/Chat';
import ImageStudio from '@/pages/ImageStudio';
import LiveVoice from '@/pages/LiveVoice';
import Maps from '@/pages/Maps';
import AudioTools from '@/pages/AudioTools';
import Vision from '@/pages/Vision';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Chat />} />
          <Route path="image" element={<ImageStudio />} />
          <Route path="live" element={<LiveVoice />} />
          <Route path="maps" element={<Maps />} />
          <Route path="audio" element={<AudioTools />} />
          <Route path="vision" element={<Vision />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
