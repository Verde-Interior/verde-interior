import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Subscribes to any change on a Supabase table and calls onRefresh.
// Uses a ref so onRefresh always reflects the latest closure (e.g. filters).
export function useRealtimeRefresh(table, onRefresh) {
  const cbRef = useRef(onRefresh);
  const channelName = useRef(`rt-${table}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => { cbRef.current = onRefresh; });

  useEffect(() => {
    const ch = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        cbRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table]);
}
