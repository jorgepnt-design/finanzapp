import { jsPDF } from 'jspdf'
import { supabase } from './supabase'

const money = (value) => new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value) || 0) + ' €'

const date = (value) => value
  ? new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T00:00:00`))
  : '–'

const monthly = (amount, interval) => {
  const value = Number(amount) || 0
  if (interval === 'einmalig') return 0
  if (interval === 'jährlich') return value / 12
  if (interval === 'halbjährlich') return value / 6
  if (interval === 'quartalsweise') return value / 3
  if (interval === 'alle 2 Monate') return value / 2
  return value
}

export async function createFinancePdf({ categories, expenses, incomes }) {
  const categoryById = Object.fromEntries((categories || []).map(c => [c.id, c.name]))
  const recurringExpenses = (expenses || []).filter(e => e.interval !== 'einmalig' && e.type !== 'Einmalige Ausgabe')
  const oneTimeExpenses = (expenses || []).filter(e => e.interval === 'einmalig' || e.type === 'Einmalige Ausgabe')
  const recurringIncomes = (incomes || []).filter(i => i.interval !== 'einmalig')
  const oneTimeIncomes = (incomes || []).filter(i => i.interval === 'einmalig')

  const monthlyExpenses = recurringExpenses.reduce((sum, item) => sum + monthly(item.amount, item.interval), 0)
  const monthlyIncome = recurringIncomes.reduce((sum, item) => sum + monthly(item.amount, item.interval), 0)
  const oneTimeExpenseTotal = oneTimeExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const oneTimeIncomeTotal = oneTimeIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const { data: loans, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .order('created_at', { ascending: false })

  if (loanError) throw loanError

  const loanTotals = (loans || []).reduce((totals, loan) => {
    totals.lent += Number(loan.amount_lent || 0)
    totals.repaid += Number(loan.amount_repaid || 0)
    totals.open += Math.max(0, Number(loan.amount_lent || 0) - Number(loan.amount_repaid || 0))
    return totals
  }, { lent: 0, repaid: 0, open: 0 })

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 16
  const right = 194
  let y = 18

  const ensureSpace = (needed = 12) => {
    if (y + needed > 282) {
      doc.addPage()
      y = 18
    }
  }

  const line = (label, value, bold = false) => {
    ensureSpace(7)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.text(String(label), left, y)
    doc.text(String(value), right, y, { align: 'right' })
    y += 6
  }

  const section = (title) => {
    ensureSpace(14)
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(title, left, y)
    y += 3
    doc.setDrawColor(220)
    doc.line(left, y, right, y)
    y += 6
  }

  const wrappedRow = (title, meta, amount) => {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title || 'Ohne Bezeichnung', left, y)
    doc.text(amount, right, y, { align: 'right' })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const wrapped = doc.splitTextToSize(meta || '', 150)
    doc.text(wrapped, left, y)
    y += Math.max(5, wrapped.length * 4) + 2
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('FinanzBlick', left, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Persönliche Finanzübersicht', left, y)
  doc.text(new Intl.DateTimeFormat('de-DE').format(new Date()), right, y, { align: 'right' })
  y += 10

  section('Zusammenfassung')
  line('Einnahmen / Monat', money(monthlyIncome), true)
  line('Laufende Kosten / Monat', money(monthlyExpenses), true)
  line('Laufende Kosten / Jahr', money(monthlyExpenses * 12))
  line('Verfügbar nach laufenden Kosten', money(monthlyIncome - monthlyExpenses), true)
  line('Einmalige Einnahmen', money(oneTimeIncomeTotal))
  line('Einmalige Ausgaben', money(oneTimeExpenseTotal))
  line('Verliehen – noch offen', money(loanTotals.open), true)

  section('Laufende Ausgaben')
  if (!recurringExpenses.length) line('Keine laufenden Ausgaben vorhanden', '')
  recurringExpenses.forEach(item => wrappedRow(
    item.name,
    `${categoryById[item.categoryId] || 'Ohne Kategorie'} · ${item.interval} · ${item.type}${item.paymentMethod ? ` · ${item.paymentMethod}` : ''}`,
    money(item.amount)
  ))

  section('Einmalige Ausgaben')
  if (!oneTimeExpenses.length) line('Keine einmaligen Ausgaben vorhanden', '')
  oneTimeExpenses.forEach(item => wrappedRow(
    item.name,
    `${categoryById[item.categoryId] || 'Ohne Kategorie'}${item.nextPaymentDate ? ` · ${date(item.nextPaymentDate)}` : ''}`,
    money(item.amount)
  ))

  section('Einnahmen')
  if (!(incomes || []).length) line('Keine Einnahmen vorhanden', '')
  ;(incomes || []).forEach(item => wrappedRow(
    item.name,
    item.interval,
    money(item.amount)
  ))

  section('Verliehenes Geld')
  line('Insgesamt verliehen', money(loanTotals.lent))
  line('Zurückgezahlt', money(loanTotals.repaid))
  line('Noch offen', money(loanTotals.open), true)
  if (!(loans || []).length) line('Kein verliehenes Geld erfasst', '')
  ;(loans || []).forEach(loan => {
    const open = Math.max(0, Number(loan.amount_lent || 0) - Number(loan.amount_repaid || 0))
    wrappedRow(
      loan.person_name,
      `Verliehen: ${money(loan.amount_lent)} · Zurück: ${money(loan.amount_repaid)} · Verliehen am: ${date(loan.lent_date)}${loan.due_date ? ` · Fällig: ${date(loan.due_date)}` : ''}`,
      open === 0 ? 'Erledigt' : `${money(open)} offen`
    )
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`FinanzBlick · Seite ${page} von ${pageCount}`, 105, 291, { align: 'center' })
    doc.setTextColor(0)
  }

  const fileName = `FinanzBlick-Uebersicht-${new Date().toISOString().slice(0,10)}.pdf`
  const blob = doc.output('blob')
  return { blob, fileName }
}

export function downloadFinancePdf(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareFinancePdf(blob, fileName) {
  const file = new File([blob], fileName, { type: 'application/pdf' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: 'FinanzBlick – Finanzübersicht',
      text: 'Meine Finanzübersicht aus FinanzBlick',
      files: [file]
    })
    return true
  }
  return false
}
