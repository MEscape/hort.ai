import { UNSAVED_WORK_GUARD } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const OPT_OUT = /@unsaved-work\s+none\s+\S/;

/**
 * A form that edits stored data loses the user's work when the tab closes or a link is followed. Credential and
 * one-step forms hold nothing worth keeping; they say so, which keeps the choice visible in review.
 * Scope: react-hook-form forms in module components. Other editors (state held by hand) are guarded by convention.
 */
export const unsavedWorkGuard = defineRule({
  description:
    'A react-hook-form form in module presentation uses an unsaved-work guard, or states `@unsaved-work none <reason>`.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module' || file.layer !== 'presentation' || file.dir !== 'components')
      return {};

    let firstUseForm = null;
    let isGuarded = false;
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name === 'useForm') firstUseForm ??= node;
        if (UNSAVED_WORK_GUARD.test(node.callee.name)) isGuarded = true;
      },
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          (node.name.name === 'UnsavedChangesGuard' || /Unsaved\w*Guard$/.test(node.name.name))
        )
          isGuarded = true;
      },
      'Program:exit'() {
        if (firstUseForm === null || isGuarded) return;
        const hasOptOut = context.sourceCode.getAllComments().some((c) => OPT_OUT.test(c.value));
        if (!hasOptOut) {
          report(
            context,
            firstUseForm,
            'This form can lose unsaved work. Call an unsaved-work guard hook (such as useReportUnsavedChanges, useUnsavedNavigationGuard, or useBeforeUnloadGuard) or add a comment `@unsaved-work none <reason>` when there is nothing worth keeping (sign-in, one field).',
          );
        }
      },
    };
  },
});
