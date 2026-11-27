import { usd, usdShort } from "../lib/format";

export function Money({ value, short }: { value: number; short?: boolean }) {
  return <span className="num">{short ? usdShort(value) : usd(value)}</span>;
}
