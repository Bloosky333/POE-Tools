/** Sorts `rows` in place by `value` (numbers or strings), descending when `desc`. */
export function sortRows<T>(rows: T[], value: (row: T) => number | string, desc: boolean): T[] {
  return rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : va - (vb as number);
    return desc ? -cmp : cmp;
  });
}
