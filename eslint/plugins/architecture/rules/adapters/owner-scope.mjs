import { loadOwnership } from '../../../../policy/ownership.mjs';
import { OWNER_SCOPE_KINDS } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const KINDS = Object.keys(OWNER_SCOPE_KINDS);
const CREATE_CALLS = new Set(['create', 'createAll', 'createMany', 'upsert', 'insert']);

/** `<x>.orm.public.<Model>`: the model, or `null`. */
function ormModel(node) {
  if (node.type !== 'MemberExpression' || node.computed || node.property.type !== 'Identifier')
    return null;
  const schema = node.object;
  if (schema.type !== 'MemberExpression' || schema.computed || schema.property.name !== 'public')
    return null;
  const orm = schema.object;
  if (orm.type !== 'MemberExpression' || orm.computed || orm.property.name !== 'orm') return null;
  return node.property.name;
}

/** The calls made on `root`, in order: `a.where(x).select(y).all()` -> where, select, all. */
function callsOn(root) {
  const calls = [];
  let current = root;
  for (;;) {
    const parent = current.parent;
    if (parent?.type === 'MemberExpression' && parent.object === current) {
      current = parent;
    } else if (parent?.type === 'CallExpression' && parent.callee === current) {
      calls.push({ name: current.property?.name ?? null, args: parent.arguments });
      current = parent;
    } else {
      return calls;
    }
  }
}

function keyName(property) {
  if (property.type !== 'Property') return null;
  if (property.key.type === 'Identifier' && !property.computed) return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return null;
}

/** Whether an object literal names one of `pins` as a key of its own. */
function objectPins(node, pins) {
  return node.properties.some((property) => {
    const name = keyName(property);
    return name !== null && pins.has(name);
  });
}

/** Whether anything under `node` names a pin: as an object key or as a member (`row.ownerId`). */
function mentionsPin(node, pins) {
  if (!node || typeof node.type !== 'string') return false;
  if (node.type === 'Property' && pins.has(keyName(node) ?? '')) return true;
  if (node.type === 'MemberExpression' && !node.computed && pins.has(node.property.name ?? ''))
    return true;
  return Object.keys(node).some((key) => {
    if (key === 'parent') return false;
    const child = node[key];
    return Array.isArray(child)
      ? child.some((item) => mentionsPin(item, pins))
      : mentionsPin(child, pins);
  });
}

/** `x as T`, `x satisfies T` and `x!` are `x`. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression')
  )
    current = current.expression;
  return current;
}

/** An identifier that names a `const` in scope, followed to what it was set to. */
function resolve(node, context) {
  let current = unwrap(node);
  for (let hops = 0; hops < 4 && current?.type === 'Identifier'; hops += 1) {
    let scope = context.sourceCode.getScope(current);
    let init = null;
    while (scope !== null && init === null) {
      const variable = scope.set.get(current.name);
      const definition = variable?.defs[0];
      init = definition?.node?.type === 'VariableDeclarator' ? definition.node.init : null;
      scope = scope.upper;
    }
    current = unwrap(init);
  }
  return current;
}

function whereIsPinned(argument, pins, context, ownerPins) {
  const value = resolve(argument, context);
  if (!value) return false;
  if (value.type === 'ObjectExpression') return objectPins(value, pins);
  if (/Function/.test(value.type)) return mentionsPin(value.body, new Set([...pins, ...ownerPins]));
  return false;
}

function writeIsPinned(call, pins, context) {
  const argument = resolve(call.args[0], context);
  if (!argument) return false;
  if (call.name === 'upsert') {
    const created =
      argument.type === 'ObjectExpression'
        ? argument.properties.find((property) => keyName(property) === 'create')
        : null;
    const row = created ? resolve(created.value, context) : null;
    return row?.type === 'ObjectExpression' && objectPins(row, pins);
  }
  if (argument.type === 'ObjectExpression') return objectPins(argument, pins);
  if (argument.type === 'ArrayExpression') {
    return (
      argument.elements.length > 0 &&
      argument.elements.every((row) => row?.type === 'ObjectExpression' && objectPins(row, pins))
    );
  }
  return false;
}

/** Whether `node` is a `<x>.raw.sql` template tag. */
function isRawSql(node) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.name === 'sql' &&
    node.object.type === 'MemberExpression' &&
    node.object.property.name === 'raw'
  );
}

/**
 * Creates the owner-scope rule with injected ownership facts.
 * When no tables are owned (e.g. OWNERSHIP.columns is empty), the rule stays dormant.
 */
export function createOwnerScopeRule(getOwnership = (context) => loadOwnership(context.cwd)) {
  return defineRule({
    description:
      'Queries on owned tables are pinned to their owner, or tagged with the owner-scope tag and a stated reason.',
    create(context) {
      const ownership = getOwnership(context);
      const tables = ownership?.tables ?? {};
      const tableNames = Object.keys(tables);
      if (tableNames.length === 0) return {};

      const { file } = classifyContext(context);
      const isRepository =
        file.area === 'module' && file.layer === 'infrastructure' && file.dir === 'prisma';
      if (!isRepository) return {};

      const sourceCode = context.sourceCode;
      const tag = ownership.tag ?? 'owner-scope';
      const TAG = new RegExp(`@${tag}[ \\t]+([\\w-]+)[ \\t]*([^\\n]*)`);
      const columns = ownership.columns ?? [];
      const QUOTED_TABLES = tableNames.map((name) => `"${name}"`);
      const RAW_PIN = columns.length > 0 ? new RegExp(`"(?:${columns.join('|')})"`) : /(?!)/;
      const OWNER_PINS = new Set(columns);

      const candidates = []; // { node, model } ORM roots
      const calls = [];
      const rawQueries = [];
      const builders = new Map();

      function isPinned(callsList, model) {
        const table = tables[model];
        if (!table) return true;
        const pins = new Set(table.pins?.length > 0 ? table.pins : [...OWNER_PINS]);
        return callsList.some((call) =>
          call.name === 'where'
            ? call.args.length > 0 && whereIsPinned(call.args[0], pins, context, OWNER_PINS)
            : CREATE_CALLS.has(call.name) &&
              call.args.length > 0 &&
              writeIsPinned(call, pins, context),
        );
      }

      function tagFor(node) {
        for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
          const comments = sourceCode.getCommentsBefore(ancestor);
          const tagged = comments.map((comment) => TAG.exec(comment.value)).find(Boolean);
          if (tagged) return tagged;
          const isDeclaration =
            ancestor.type === 'MethodDefinition' || ancestor.type === 'FunctionDeclaration';
          if (isDeclaration) {
            const exported =
              ancestor.parent?.type === 'ExportNamedDeclaration' ? ancestor.parent : null;
            const outer = exported ? sourceCode.getCommentsBefore(exported) : [];
            return outer.map((comment) => TAG.exec(comment.value)).find(Boolean) ?? null;
          }
          if (ancestor.type === 'Program') return null;
        }
        return null;
      }

      function isTagged(node) {
        const tagMatch = tagFor(node);
        if (tagMatch === null) return false;
        const [, kind, reason] = tagMatch;
        if (!KINDS.includes(kind) || reason.replace(/\*\/\s*$/, '').trim() === '') {
          report(
            context,
            node,
            `\`@${tag} ${kind}\` needs a kind (${KINDS.join(', ')}) and a one-line reason saying what binds the query to an owner instead.`,
          );
        }
        return true;
      }

      function judge(node, model) {
        if (!(model in tables)) return;
        if (isPinned(callsOn(node), model)) return;
        if (isTagged(node)) return;
        const table = tables[model];
        const pinned =
          table.pins?.length > 0
            ? table.pins.join(' / ')
            : table.via
              ? `its ${table.via}`
              : 'its owner key';
        report(
          context,
          node,
          `A query on \`${model}\` is not bound to its owner: constrain ${pinned} in its \`.where(…)\` or \`create(…)\`, or say why it needs none with \`@${tag} <${KINDS.join('|')}> <reason>\`.`,
        );
      }

      return {
        MemberExpression(node) {
          const model = ormModel(node);
          if (model !== null) candidates.push({ node, model });
        },
        CallExpression(node) {
          if (node.callee.type === 'Identifier') calls.push(node);
        },
        TaggedTemplateExpression(node) {
          if (isRawSql(node.tag)) rawQueries.push(node);
        },
        'Program:exit'() {
          for (const { node, model } of candidates) {
            const tagMatch =
              model in tables && !isPinned(callsOn(node), model) ? tagFor(node) : null;
            if (tagMatch?.[1] !== 'builder') continue;
            for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
              if (ancestor.type === 'VariableDeclarator' && ancestor.id.type === 'Identifier') {
                builders.set(ancestor.id.name, model);
                break;
              }
              if (ancestor.type === 'FunctionDeclaration' && ancestor.id) {
                builders.set(ancestor.id.name, model);
                break;
              }
            }
          }
          for (const { node, model } of candidates) judge(node, model);
          for (const call of calls) {
            const model = builders.get(call.callee.name);
            if (model !== undefined) judge(call, model);
          }
          for (const node of rawQueries) {
            const text = node.quasi.quasis.map((part) => part.value.raw).join(' ');
            if (!QUOTED_TABLES.some((table) => text.includes(table)) || RAW_PIN.test(text))
              continue;
            if (isTagged(node)) continue;
            const pinDesc =
              columns.length > 0 ? columns.map((c) => `"${c}"`).join(' or ') : 'its owner';
            report(
              context,
              node,
              `A raw statement on an owned table must constrain ${pinDesc} in its text, or say why it needs none with \`@${tag} <kind> <reason>\`.`,
            );
          }
        },
      };
    },
  });
}

export const ownerScope = createOwnerScopeRule();
