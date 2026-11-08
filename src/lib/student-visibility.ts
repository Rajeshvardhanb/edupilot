import "server-only";
import { Prisma } from "@prisma/client";
import sampleRolls from "./sample-student-rolls.json";

// Only these original generated identities are hidden. New registrations are visible.
export const visibleStudentWhere = { archivedAt: null, rollNo: { notIn: sampleRolls } } satisfies Prisma.StudentWhereInput;
export const visibleStudentIdsSql = Prisma.sql`SELECT id FROM Student WHERE archivedAt IS NULL AND rollNo NOT IN (${Prisma.join(sampleRolls)})`;

type Args = Record<string, unknown>;
const relations = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name,
  new Map(model.fields.filter(f => f.kind === "object").map(f => [f.name, f]))]));
const readOperations = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);

function modelScope(model: string): Args | undefined {
  if (model === "Student") return visibleStudentWhere;
  // Records belonging to hidden students (submissions, results, accounts, etc.)
  // must also stay out of presentation lists and relation counts.
  const fields = [...(relations.get(model)?.values() ?? [])].filter(f => f.type === "Student" && !f.isList);
  if (!fields.length) return undefined;
  return { AND: fields.map(f => f.isRequired
    ? { [f.name]: visibleStudentWhere }
    : { OR: [{ [f.name]: null }, { [f.name]: visibleStudentWhere }] }) };
}

function withScope(where: unknown, scope: Args): Args {
  const original = (where ?? {}) as Args;
  const previous = original.AND === undefined ? [] : Array.isArray(original.AND) ? original.AND : [original.AND];
  return { ...original, AND: [...previous, scope] };
}

function scopeCount(model: string, input: unknown): unknown {
  if (!input) return input;
  const fields = relations.get(model);
  const count = input === true
    ? { select: Object.fromEntries([...(fields?.values() ?? [])].filter(f => f.isList).map(f => [f.name, true])) }
    : input as Args;
  if (!count.select || typeof count.select !== "object") return input;
  const select = { ...count.select } as Args;
  for (const [name, value] of Object.entries(select)) {
    const field = fields?.get(name);
    const scope = field && modelScope(field.type);
    if (!value || !scope) continue;
    const options = value === true ? {} : value as Args;
    select[name] = { ...options, where: withScope(options.where, scope) };
  }
  return { ...count, select };
}

function selection(model: string, input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(Object.entries(input).map(([name, value]) => {
    if (name === "_count") return [name, scopeCount(model, value)];
    const field = relations.get(model)?.get(name);
    if (!field || !value) return [name, value];
    if (value === true && (!field.isList || !modelScope(field.type))) return [name, value];
    return [name, scopeArguments(field.type, value === true ? {} : value as Args, field.isList)];
  }));
}

function scopeArguments(model: string, args: Args, applyWhere: boolean): Args {
  const scoped = { ...args };
  const scope = applyWhere ? modelScope(model) : undefined;
  if (scope) scoped.where = withScope(args.where, scope);
  for (const key of ["include", "select"]) {
    if (args[key]) scoped[key] = selection(model, args[key]);
  }
  return scoped;
}

/** Apply to reads only. Raw backup/maintenance clients retain all database records. */
export function presentationRead(model: string, operation: string, args: Args): Args {
  return readOperations.has(operation) ? scopeArguments(model, args, true) : args;
}
