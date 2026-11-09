/** Simple self-drawn chain marks (not official logos). */
export default function ChainMark({ chain }: { chain: string }) {
  const c = chain.toLowerCase();
  let shape: React.ReactNode;
  if (c.includes("base")) shape = <circle cx="12" cy="12" r="9" fill="none" stroke="#7CC4FF" strokeWidth="3" />;
  else if (c.includes("eth")) shape = <path d="M12 2l7 10-7 4-7-4zM12 22l7-8-7 4-7-4z" fill="#B7A6FF" />;
  else if (c.includes("arb")) shape = <path d="M4 20L12 4l8 16-8-5z" fill="none" stroke="#5FE3B0" strokeWidth="2.5" strokeLinejoin="round" />;
  else if (c === "op" || c.includes("opt")) shape = (<><circle cx="12" cy="12" r="9" fill="#FF6B81" /><circle cx="12" cy="12" r="3.5" fill="#0B0F1E" /></>);
  else if (c.includes("pol")) shape = <path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" fill="none" stroke="#F5B94A" strokeWidth="2.5" />;
  else shape = <rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#8A93AD" strokeWidth="2.5" />;
  return <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden className="shrink-0">{shape}</svg>;
}
