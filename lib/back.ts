/** "Orqaga" uchun umumiy stek: ochiq oynalar (Sheet) o'z yopish funksiyasini shu yerga qo'yadi.
 *  Orqaga bosilganda avval eng ustdagi oyna yopiladi. */
type Fn = () => void;
const stack: Fn[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function pushBack(fn: Fn): () => void {
  stack.push(fn);
  emit();
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
    emit();
  };
}

/** Eng ustdagi oynani yopadi. Oyna bo'lmasa false. */
export function popBack(): boolean {
  const f = stack[stack.length - 1];
  if (!f) return false;
  f();
  return true;
}

export const backDepth = () => stack.length;

export function onBackChange(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
