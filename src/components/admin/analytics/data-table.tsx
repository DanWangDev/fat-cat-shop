interface Column<T> {
  header: string;
  accessor: (row: T) => string | number;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, emptyMessage = "No data" }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-warm-brown/50">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warm-brown/10">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`py-2 pr-4 text-xs font-bold uppercase tracking-wider text-warm-brown/50 ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-warm-brown/5">
              {columns.map((col, ci) => (
                <td
                  key={ci}
                  className={`py-2 pr-4 text-warm-brown ${col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
