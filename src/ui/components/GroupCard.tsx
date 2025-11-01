// Migrated GroupCard (Batch C primitives) (AT-P2.M4-09)
import React from 'react';

interface GroupCardProps { title: string; description?: string; dirty?: boolean; children: React.ReactNode; footer?: React.ReactNode; collapsed?: boolean; onToggleCollapse?: () => void; }

const GroupCardBase: React.FC<GroupCardProps> = ({ title, description, dirty, children, footer, collapsed, onToggleCollapse }) => {
	const panelId = React.useId();
	const headingId = React.useId();
	return (
		<div role="region" aria-labelledby={headingId} style={{ border:'1px solid var(--vscode-editorWidget-border)', borderRadius:4, marginBottom:16, background:'var(--vscode-editor-background)' }}>
			<div style={{ display:'flex', alignItems:'center', padding:'6px 10px' }}>
				<button type="button" aria-expanded={!collapsed} aria-controls={panelId} onClick={onToggleCollapse} style={{ flex:1, textAlign:'left', background:'transparent', border:'none', padding:0, fontWeight:600, cursor:onToggleCollapse?'pointer':'default' }} id={headingId}>
					{title}
					{dirty && <span style={{ fontSize:10, color:'var(--vscode-errorForeground)', marginLeft:6 }}>• <span className="visually-hidden">unsaved changes</span></span>}
				</button>
				<span aria-hidden="true" style={{ marginLeft:8, opacity:0.7 }}>{collapsed ? '▸' : '▾'}</span>
			</div>
			{!collapsed && (
				<div id={panelId} style={{ padding:'0 14px 12px' }}>
					{description && <p style={{ marginTop:0, marginBottom:8, fontSize:12, color:'var(--vscode-descriptionForeground)' }}>{description}</p>}
					<div style={{ display:'grid', gap:12 }}>{children}</div>
					{footer && <div style={{ marginTop:12 }}>{footer}</div>}
				</div>
			)}
		</div>
	);
};

export const GroupCard = React.memo(GroupCardBase);
export default GroupCard;