import React, { useState } from 'react'
import { FileDown, Share2 } from 'lucide-react'
import { supabase } from './supabase'
import { createFinancePdf, downloadFinancePdf, shareFinancePdf } from './pdfReport'

export default function ReportActions() {
  const [busy, setBusy] = useState(false)

  async function loadData() {
    const [{ data: categories, error: catError }, { data: expenses, error: expError }, { data: incomes, error: incError }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('expenses').select('*').order('created_at', { ascending: false }),
      supabase.from('incomes').select('*').order('created_at', { ascending: false })
    ])
    if (catError) throw catError
    if (expError) throw expError
    if (incError) throw incError

    return {
      categories: categories || [],
      expenses: (expenses || []).map(e => ({
        id: e.id,
        name: e.name,
        amount: Number(e.amount),
        categoryId: e.category_id,
        type: e.expense_type,
        interval: e.payment_interval,
        nextPaymentDate: e.next_payment_date || '',
        paymentMethod: e.payment_method || '',
        provider: e.provider || '',
        contractNumber: e.contract_number || '',
        cancellationDate: e.cancellation_date || '',
        notes: e.notes || ''
      })),
      incomes: (incomes || []).map(i => ({
        id: i.id,
        name: i.name,
        amount: Number(i.amount),
        interval: i.payment_interval,
        notes: i.notes || ''
      }))
    }
  }

  async function makePdf(mode) {
    if (busy) return
    setBusy(true)
    try {
      const data = await loadData()
      const { blob, fileName } = await createFinancePdf(data)

      if (mode === 'share') {
        const shared = await shareFinancePdf(blob, fileName)
        if (!shared) {
          downloadFinancePdf(blob, fileName)
          alert('Direktes Teilen von PDF-Dateien wird auf diesem Gerät nicht unterstützt. Die PDF wurde stattdessen heruntergeladen.')
        }
      } else {
        downloadFinancePdf(blob, fileName)
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error(error)
        alert(`PDF konnte nicht erstellt werden: ${error.message}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return <div className="report-actions" aria-label="Finanzübersicht exportieren">
    <button className="report-action" disabled={busy} onClick={()=>makePdf('download')} title="Finanzübersicht als PDF herunterladen">
      <FileDown size={19}/><span>{busy ? 'Erstelle …' : 'PDF'}</span>
    </button>
    <button className="report-action share" disabled={busy} onClick={()=>makePdf('share')} title="Finanzübersicht teilen">
      <Share2 size={19}/><span>Teilen</span>
    </button>
  </div>
}
