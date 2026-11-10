# v80: Choose sets for a study session

- Home's **Выбрать наборы** opens the study selector, not library management. Every nonempty set is present on home, including **Разговорное произношение**; the old first-six limit is removed. A set row starts its own folder immediately. Selected sets are marked **В занятии**, and the home study summary names a single selected set.
- The selector starts with folders, search and checkboxes. It displays the existing hierarchy with indentation and per-folder card totals. Search never clears the selection, and **Все папки** remains visible so the user can clear the previous choice while searching.
- **Учить выбранное** saves the selection and routes directly into English flashcards. Individual-card selection remains available under the collapsed **Отдельные карточки** disclosure. The same selector retains a separate **Использовать выбранное** action for sentence training and never redirects sentence selection into cards.
- Folder checkbox state is based on the actual chosen cards. Parents can be partially selected; unchecking a child removes those cards even when its parent was selected. Whole-folder choices remain open to future additions (`cardIds: null`); genuine partial choices use the existing `cardIds` format. Untouched individual-card selections retain their original scope.
- New intake round-robins actual folders, so a combined session can include both sets without filling all five learning slots from the first set. v79's five-new-per-day limit, reserved learning batch, FSRS intervals and overdue priorities are unchanged.
- No folder is renamed, moved or deleted. Existing profiles, backups and study-setting formats are unchanged. Cancel leaves the saved selection intact. Pre-change checkpoint: `v79`.

Browser sources remain in `public/`. Compatibility copies and the standalone Cloudflare artifact are generated with `npm run build:worker`. GitHub checkpoints do not deploy production.
