import { Check } from 'lucide-react';

const STEPS = ['Guidelines', 'System check', 'Start'];

export default function Stepper({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="ui-stepper" aria-label="Exam setup progress">
      {STEPS.map((label, i) => (
        <li key={label} className={`ui-step ${i === current ? 'ui-step--active' : i < current ? 'ui-step--done' : ''}`} aria-current={i === current ? 'step' : undefined}>
          <span className="ui-step__dot">{i < current ? <Check size={14} strokeWidth={2.25} /> : i + 1}</span>
          {label}
          {i < STEPS.length - 1 && <span className="ui-step__bar" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
