import { useMemo, useState } from 'preact/hooks';
import type { Menu, Meze } from '../shared/types';
import { useToast } from './toast';
import { Modal, PeoplePicker, copyText } from './ui';

/** One line per dish: English name, Turkish name and the recipe link. */
function dishLine(m: Meze, i: number) {
  const tr = m.nameTr && m.nameTr !== m.name ? ` / ${m.nameTr}` : '';
  const serves = m.serves ? ` — recipe serves ${m.serves} as a meze` : '';
  const link = m.recipeUrl ? ` — ${m.recipeUrl}` : m.nightId ? ' — (custom dish, no recipe)' : ' — (no recipe link)';
  return `${i + 1}. ${m.name}${tr}${serves}${link}`;
}

/** A copyable prompt naming every dish in a menu, for pasting into ChatGPT or Claude. */
export function CookPlan({ menu, mezeById, defaultPeople, onClose }: { menu: Menu; mezeById: Map<string, Meze>; defaultPeople: number; onClose: () => void }) {
  const [people, setPeople] = useState(Math.max(1, defaultPeople));
  const toast = useToast();
  const dishes = menu.mezeIds.map((id) => mezeById.get(id)).filter((m): m is Meze => !!m);

  const text = useMemo(
    () =>
      [
        `We're cooking a Turkish meze spread called "${menu.name}" for ${people} people.`,
        '',
        'The dishes (English name / Turkish name, then the recipe link):',
        ...dishes.map(dishLine),
        '',
        `Please read the linked recipes and write one combined plan: a shared shopping list with quantities scaled for ${people}, the prep that can be done ahead, and a cooking timeline that gets everything to the table together. Where there is no link, use a classic version of the dish.`,
      ].join('\n'),
    [dishes, people, menu.name],
  );

  function copy() {
    copyText(text).then(
      () => toast('Brief copied. Paste it into ChatGPT or Claude!'),
      () => toast('Could not copy; select the text instead.', 'error'),
    );
  }

  return (
    <Modal title={`🧑‍🍳 Cooking brief for "${menu.name}"`} onClose={onClose}>
      <PeoplePicker people={people} setPeople={setPeople} />
      <p class="muted small">Copy this and paste it into ChatGPT or Claude to get one combined set of instructions for the whole spread.</p>
      <pre class="brief">{text}</pre>
      <div class="tip">💡 The links do the heavy lifting, so use an assistant that can open them — otherwise you'll get a plausible-sounding recipe rather than the real one.</div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" class="btn btn-primary" onClick={copy}>
          📋 Copy the brief
        </button>
      </div>
    </Modal>
  );
}
