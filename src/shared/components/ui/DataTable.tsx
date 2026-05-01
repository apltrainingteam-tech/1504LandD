import React, { ReactNode, memo } from 'react';

interface DataTableProps {
  headers: (string | { label: string, key: string, sortable?: boolean })[];
  children: ReactNode;
  maxHeight?: string;
  stickyFirstColumn?: boolean;
}

export const DataTable: React.FC<DataTableProps> = memo(({ 
  headers, 
  children, 
  maxHeight = 'auto',
  stickyFirstColumn = true
}) => {
  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-container" style={{ maxHeight, overflowY: maxHeight !== 'auto' ? 'auto' : 'visible' }}>
        <table>
          <thead>
            <tr>
              {headers.map((h, i) => {
                const label = typeof h === 'string' ? h : h.label;
                const isFirst = i === 0 && stickyFirstColumn;
                return (
                  <th 
                    key={i} 
                    className={isFirst ? 'sticky-col' : ''}
                    style={isFirst ? { position: 'sticky', left: 0, zIndex: 10, background: '#0F1C3F' } : {}}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
});



