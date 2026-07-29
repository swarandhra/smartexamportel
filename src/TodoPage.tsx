import { useEffect, useState } from 'react';
import { createClient } from './utils/supabase/client';

interface Todo {
  id: string;
  name: string;
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTodos() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('todos').select('id, name');
        
        if (error) {
          throw error;
        }
        
        setTodos(data as Todo[] || []);
      } catch (err: any) {
        console.error('Supabase Todo Fetch Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTodos();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading Supabase Todos...</div>;
  }

  if (error) {
    return (
      <div className="error-notice" style={{ color: 'var(--danger)', padding: '12px' }}>
        <strong>Database Connection Status:</strong> Offline / Missing Schema ({error})
      </div>
    );
  }

  return (
    <div className="supabase-todos-preview" style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
      <h4 style={{ color: 'var(--dark-blue)', marginBottom: '12px', fontSize: '14px' }}>Supabase Todos Table Sync</h4>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {todos.map((todo) => (
          <li key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
            {todo.name}
          </li>
        ))}
        {todos.length === 0 && (
          <li style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No items in 'todos' table yet.</li>
        )}
      </ul>
    </div>
  );
}
