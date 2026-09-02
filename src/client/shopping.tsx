import { useMemo, useState } from 'preact/hooks';
import type { Menu, Meze } from '../shared/types';
import { useToast } from './toast';
import { Modal, ingredientLine, scaleIngredient } from './ui';

/** Scaled, per-dish shopping list for a menu, with a copy button. */
export function ShoppingList({ menu, mezeById, defaultPeople, onClose }: { menu: Menu; mezeById: Map<string, Meze>; defaultPeople: number; onClose: () => void }) {
  const [people, setPeople] = useState(Math.max(1, defaultPeople));
  const toast = useToast();
  const dishes = menu.mezeIds.map((id) => mezeById.get(id)).filter((m): m is Meze => !!m);

  const text = useMemo(() => {
    const lines: string[] = [`Shopping list: ${menu.name} (for ${people} people)`, ''];
    for (const m of dishes) {
      lines.push(`## ${m.name}${m.nameTr && m.nameTr !== m.name ? ` (${m.nameTr})` : ''}`);
      if (m.ingredients.length === 0) lines.push(m.recipeUrl ? `- see recipe: ${m.recipeUrl}` : '- (custom dish, no ingredient list)');
      const factor = m.serves ? people / m.serves : 1;
      for (const ing of m.ingredients) lines.push(`- ${ingredientLine(scaleIngredient(ing, factor))}`);
      lines.push('');
    }
    return lines.join('\n');
  }, [dishes, people, menu.name]);

  function copy() {
    navigator.clipboard?.writeText(text).then(
      () => toast('Shopping list copied. Off to the market!'),
      () => toast('Could not copy; select the text instead.', 'error'),
    );
  }

  return (
    <Modal title={`🛒 Shopping for "${menu.name}"`} onClose={onClose}>
      <div class="people-row">
        <span>How many people?</span>
        <div class="stepper">
          <button type="button" class="btn btn-small" onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="Fewer people">
            −
          </button>
          <b>{people}</b>
          <button type="button" class="btn btn-small" onClick={() => setPeople((p) => Math.min(60, p + 1))} aria-label="More people">
            +
          </button>
        </div>
      </div>
      <p class="muted small">Amounts are scaled from each recipe's meze portion size and rounded, so treat them as a guide.</p>
      <div class="shopping">
        {dishes.map((m) => {
          const factor = m.serves ? people / m.serves : 1;
          return (
            <section key={m.id}>
              <h3>{m.name}</h3>
              {m.ingredients.length === 0 ? (
                <p class="muted small">{m.nightId ? 'Custom dish, no ingredient list.' : 'No ingredient list; check the recipe.'}</p>
              ) : (
                <ul class="ingredients">
                  {m.ingredients.map((ing, i) => (
                    <li key={i}>{ingredientLine(scaleIngredient(ing, factor))}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <div class="tip">
        💡 Same ingredient across several dishes? We don't merge them, but ChatGPT or Claude will: copy the list, paste it in, and ask for one combined shopping list.
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" class="btn btn-primary" onClick={copy}>
          📋 Copy the list
        </button>
      </div>
    </Modal>
  );
}
