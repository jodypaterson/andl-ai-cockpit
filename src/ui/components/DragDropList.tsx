// Migrated DragDropList (AT-P2.M4-09)
import React from 'react';

export interface DragDropListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  renderItem: (ctx: { item: T; index: number; dragHandleProps: any; isDragging: boolean }) => React.ReactNode;
  ariaLabel?: string;
  orientation?: 'vertical' | 'horizontal';
  enableKeyboard?: boolean; // Alt/Ctrl + Arrow moves items
}

export function DragDropList<T>(props: DragDropListProps<T>) {
  const { items, getKey, onReorder, renderItem, ariaLabel, orientation='vertical', enableKeyboard=true } = props;
  const dragIndexRef = React.useRef<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from,1); next.splice(to,0,it);
    onReorder(next);
  };
  const onDragStart = (e: React.DragEvent, idx: number) => { dragIndexRef.current = idx; try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; };
  const onDrop = (e: React.DragEvent, idx: number) => { e.preventDefault(); let from = dragIndexRef.current; if (from==null) { try { const dt = parseInt(e.dataTransfer.getData('text/plain'),10); if(!isNaN(dt)) from = dt; } catch {}; } if (from==null) return; move(from, idx); dragIndexRef.current=null; };
  const onDragEnd = () => { dragIndexRef.current=null; };
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => { if (!enableKeyboard) return; const isPrev = e.key==='ArrowUp'||(orientation==='horizontal'&&e.key==='ArrowLeft'); const isNext = e.key==='ArrowDown'||(orientation==='horizontal'&&e.key==='ArrowRight'); if ((e.metaKey||e.ctrlKey||e.altKey) && (isPrev||isNext)) { e.preventDefault(); move(idx, idx + (isPrev? -1:1)); } };
  return (
    <ul aria-label={ariaLabel} role="list" style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection: orientation==='vertical'? 'column':'row', gap:4 }}>
      {items.map((it, idx)=> {
        const key = getKey(it, idx);
        const dragging = dragIndexRef.current === idx;
        const dragHandleProps = { draggable:true, onDragStart:(e:React.DragEvent)=>onDragStart(e,idx), onDragOver:(e:React.DragEvent)=>onDragOver(e,idx), onDrop:(e:React.DragEvent)=>onDrop(e,idx), onDragEnd, onKeyDown:(e:React.KeyboardEvent)=>onKeyDown(e,idx), tabIndex:0, 'aria-label':`Reorder item ${idx+1} of ${items.length}` };
        return <li key={key} style={{ position:'relative' }}>{renderItem({ item: it, index: idx, dragHandleProps, isDragging: dragging })}</li>;
      })}
    </ul>
  );
}

export default DragDropList;