import { invalid, ruleTester, rules, valid } from './rule-tester';

const MODULE_COMPONENT = 'src/modules/shop/presentation/components/order-card.tsx';
const SHARED_COMPONENT = 'src/components/shared/order-chip.tsx';

const HOOK_ONLY = `
export function OrderCard({ order }: Props) {
  const t = useTranslations('shop');
  const { isOpen, toggle } = useDisclosure();
  return <button onClick={toggle}>{isOpen ? t('close') : order.name}</button>;
}`;

const SIX_THINGS = `
export function OrderCard({ order }: Props) {
  const a = order.a;
  const b = order.b;
  const c = a + b;
  const d = c * 2;
  const e = d - 1;
  const f = e + a;
  return <p>{f}</p>;
}`;

ruleTester.run('architecture/component-logic', rules['component-logic']!, {
  valid: [
    // composing hooks and returning markup is what a component does
    valid(MODULE_COMPONENT, HOOK_ONLY),
    // a small component may keep a little state of its own: moving it out would only add a file
    valid(
      MODULE_COMPONENT,
      'export function A() { const [o, setO] = useState(false); return <p onClick={() => setO(!o)}>x</p>; }',
    ),
    valid(
      SHARED_COMPONENT,
      `export const Copy = () => {
  const [done, setDone] = useState(false);
  useEffect(() => { if (done) setTimeout(() => setDone(false), 1000); }, [done]);
  return <button onClick={() => setDone(true)}>{String(done)}</button>;
};`,
    ),
    // up to five things are fine, whatever they are
    valid(
      MODULE_COMPONENT,
      `export function A({ o }: P) {
  const [open, setOpen] = useState(false);
  const a = o.a;
  const b = o.b;
  const c = a + b;
  useEffect(() => {}, []);
  return <p>{c}{String(open)}</p>;
}`,
    ),
    // a Server Component's words and formats are composition, not logic
    valid(
      MODULE_COMPONENT,
      `export async function A({ locale }: P) {
  const t = await getTranslations({ locale });
  const f = await getFormatter({ locale });
  return <p>{t('a')}{f.number(1)}</p>;
}`,
    ),
    // hooks files and primitives are outside the rule
    valid(
      'src/modules/shop/presentation/hooks/use-open.ts',
      'export function useOpen() { return useState(false); }',
    ),
    valid(
      'src/components/ui/switch.tsx',
      'export function Switch() { const a = 1; const b = 2; const c = 3; const d = 4; const e = 5; const f = 6; return <i>{a + b + c + d + e + f}</i>; }',
    ),
    // lowercase functions are helpers, not components
    valid(
      MODULE_COMPONENT,
      'function summarise(o: O) { const a = 1; const b = 2; const c = 3; const d = 4; const e = 5; const f = 6; return a + b + c + d + e + f; }',
    ),
  ],
  invalid: [
    invalid(
      MODULE_COMPONENT,
      SIX_THINGS,
      /OrderCard does 6 things besides calling hooks and returning markup \(at most 5\)/,
    ),
    // React's own hooks count as things the component does
    invalid(
      SHARED_COMPONENT,
      `export const Chip = () => {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);
  useEffect(() => {}, []);
  const d = useMemo(() => 1, []);
  const e = useCallback(() => 2, []);
  return <p>{a}{b}{c}{d}{e}{setA}{setB}{setC}</p>;
};`,
      /Chip does 6 things/,
    ),
    // an arrow component is a component too
    invalid(
      SHARED_COMPONENT,
      `export const Chip = ({ o }: P) => {
  const a = o.a; const b = o.b; const c = o.c; const d = o.d; const e = o.e; const f = o.f;
  return <p>{a}{b}{c}{d}{e}{f}</p>;
};`,
      /Chip does 6 things/,
    ),
  ],
});
