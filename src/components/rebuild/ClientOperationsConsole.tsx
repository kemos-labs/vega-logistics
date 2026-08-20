'use client';

import dynamic from 'next/dynamic';

const OperationsConsole = dynamic(() => import('./OperationsConsole'), {
  ssr: false,
  loading: () => <div className="ops-loading" aria-label="Loading VEGA OS">Loading operations…</div>,
});

export default function ClientOperationsConsole() {
  return <OperationsConsole />;
}
