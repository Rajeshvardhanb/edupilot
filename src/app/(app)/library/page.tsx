import { banner } from "@/lib/images";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, isoDate } from "@/lib/format";
import { issueBook, returnBook, saveBook } from "@/actions/campus";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, StatCard, Th, Table, PageBanner } from "@/components/ui-server";
import { Filters, SearchInput } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Library" };

export default async function LibraryPage(props: PageProps<"/library">) {
  const user = await requireUser(["ADMIN", "OFFICE", "FACULTY", "STUDENT"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const admin = isOffice(user);
  const today = new Date(isoDate(new Date()));
  const [books, issues, totals] = await Promise.all([
    db.book.findMany({ where: q ? { OR: [{ title: { contains: q } }, { author: { contains: q } }, { category: { contains: q } }, { isbn: { contains: q } }] } : {}, include: { _count: { select: { issues: { where: { returnedOn: null } } } } }, orderBy: { title: "asc" }, take: 100 }),
    db.bookIssue.findMany({ where: { returnedOn: null, ...(admin ? {} : { userId: user.id }) }, include: { book: true, user: { select: { name: true, student: { select: { rollNo: true } } } } }, orderBy: { dueOn: "asc" } }),
    db.book.aggregate({ _sum: { copies: true }, _count: true }),
  ]);
  const overdue = issues.filter((i) => i.dueOn < today).length;
  return (
    <>
      <PageBanner {...banner("library")} eyebrow="Central library" tint="#0f4f46" title="Library" subtitle={admin ? "Catalogue, issue and return. Loan period 14 days, fine ₹2 per day, 3 books per member." : "Search the catalogue and see the books you have borrowed."} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Titles" value={totals._count} /><StatCard label="Copies" value={totals._sum.copies ?? 0} tone="info" />
        <StatCard label={admin ? "Books on loan" : "My books"} value={issues.length} tone="warning" /><StatCard label="Overdue" value={overdue} tone={overdue ? "danger" : "success"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={admin ? "Books on loan" : "My borrowed books"}>
            {issues.length === 0 ? <p className="text-sm text-muted">No books on loan.</p> : (
              <Table>
                <thead><tr><Th>Book</Th>{admin && <Th>Member</Th>}<Th>Issued</Th><Th>Due</Th>{admin && <Th />}</tr></thead>
                <tbody>{issues.map((i) => {
                  const late = Math.max(0, Math.floor((today.getTime() - i.dueOn.getTime()) / 864e5));
                  return (
                    <tr key={i.id}>
                      <Td>{i.book.title}<p className="text-xs text-muted">{i.book.author}</p></Td>
                      {admin && <Td>{i.user.name}<p className="font-mono text-xs text-muted">{i.user.student?.rollNo}</p></Td>}
                      <Td>{fmtDate(i.issuedOn)}</Td>
                      <Td>{fmtDate(i.dueOn)} {late > 0 && <Badge tone="danger">{late}d late · ₹{late * 2}</Badge>}</Td>
                      {admin && <Td><ActionButton action={returnBook} fields={{ id: i.id }}>Return</ActionButton></Td>}
                    </tr>
                  );
                })}</tbody>
              </Table>
            )}
          </Card>
          <Card title="Catalogue">
            <Filters><SearchInput placeholder="Title, author, subject or ISBN" defaultValue={q} /></Filters>
      <SavedFilters storageKey="edupilot-filters-library" />
            {books.length === 0 ? <EmptyState title="No books found" /> : (
              <Table>
                <thead><tr><Th>Title</Th><Th>Category</Th><Th>Availability</Th>{admin && <Th>Issue to</Th>}</tr></thead>
                <tbody>{books.map((b) => {
                  const free = b.copies - b._count.issues;
                  return (
                    <tr key={b.id}>
                      <Td><p className="font-medium">{b.title}</p><p className="text-xs text-muted">{b.author}{b.isbn && ` · ISBN ${b.isbn}`}</p></Td>
                      <Td>{b.category ?? "—"}</Td>
                      <Td><Badge tone={free > 0 ? "success" : "danger"}>{free > 0 ? `${free} of ${b.copies} available` : "All issued"}</Badge></Td>
                      {admin && <Td>{free > 0 && (
                        <ActionForm action={issueBook} className="flex gap-1" resetOnSuccess>
                          <input type="hidden" name="bookId" value={b.id} />
                          <input name="member" placeholder="Roll no / emp ID" className="input w-36 py-1 text-xs" required />
                          <SubmitButton size="sm" variant="secondary">Issue</SubmitButton>
                        </ActionForm>
                      )}</Td>}
                    </tr>
                  );
                })}</tbody>
              </Table>
            )}
          </Card>
        </div>
        {admin && (
          <Card title="Add a book" className="h-fit">
            <ActionForm action={saveBook} className="space-y-3" resetOnSuccess>
              <Field label="Title" name="title"><input id="title" name="title" className="input" required /></Field>
              <Field label="Author" name="author"><input id="author" name="author" className="input" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ISBN" name="isbn"><input id="isbn" name="isbn" className="input" /></Field>
                <Field label="Copies" name="copies"><input id="copies" name="copies" type="number" min={1} defaultValue={1} className="input" /></Field>
              </div>
              <Field label="Category" name="category"><input id="category" name="category" className="input" placeholder="Computer Science" /></Field>
              <SubmitButton>Add to catalogue</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
